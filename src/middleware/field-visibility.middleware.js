/**
 * Middleware to filter response data based on user role
 * This provides role-based field visibility for patient data
 */
const fieldVisibilityMiddleware = {
  /**
   * Apply role-based field visibility to patient data in response
   * @param {Array<string>} allowedRoles - Roles that can access all fields
   */
  filterPatientData: (allowedRoles = ['admin', 'doctor']) => {
    return (req, res, next) => {
      // Store the original res.json function
      const originalJson = res.json;
      
      // Override res.json to filter data based on user role
      res.json = function(data) {
        // Only apply filtering if there is patient data and the user doesn't have an allowed role
        if (
          data && 
          data.data && 
          !allowedRoles.includes(req.user.role)
        ) {
          // Apply different filtering based on role
          if (req.user.role === 'nurse') {
            // Nurses can see most data except certain sensitive information
            filterNurseView(data.data);
          } else if (req.user.role === 'receptionist') {
            // Receptionists only see basic demographics and administrative data
            filterReceptionistView(data.data);
          } else if (req.user.role === 'patient') {
            // Patients see their own data but not necessarily all medical notes
            filterPatientView(data.data, req.user._id);
          }
        }
        
        // Call the original json method with the filtered data
        return originalJson.call(this, data);
      };
      
      next();
    };
  }
};

/**
 * Filter data for nurse role
 * @private
 * @param {Object} data - Response data to filter
 */
function filterNurseView(data) {
  if (!data) return;
  
  // If it's an array, filter each item
  if (Array.isArray(data)) {
    data.forEach(item => filterNurseView(item));
    return;
  }
  
  // Fields to remove for nurse role
  const restrictedFields = [
    'insurance.policyNumber',
    'insurance.groupNumber',
    'secondaryInsurance.policyNumber',
    'secondaryInsurance.groupNumber',
    'mentalHealth.suicidalIdeation',
    'lifestyle.recreationalDrugDetails',
    'advancedDirectives',
    'ssn'
  ];
  
  // Remove restricted fields
  restrictedFields.forEach(field => {
    const parts = field.split('.');
    let obj = data;
    
    // Navigate to the parent object
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj && typeof obj === 'object' && parts[i] in obj) {
        obj = obj[parts[i]];
      } else {
        return; // Field doesn't exist
      }
    }
    
    // Delete the field
    if (obj && typeof obj === 'object') {
      delete obj[parts[parts.length - 1]];
    }
  });
}

/**
 * Filter data for receptionist role
 * @private
 * @param {Object} data - Response data to filter
 */
function filterReceptionistView(data) {
  if (!data) return;
  
  // If it's an array, filter each item
  if (Array.isArray(data)) {
    data.forEach(item => filterReceptionistView(item));
    return;
  }
  
  // Allowed top-level fields for receptionists
  const allowedFields = [
    '_id',
    'user',
    'dateOfBirth',
    'gender',
    'address',
    'phoneNumber',
    'alternatePhoneNumber',
    'preferredContactMethod',
    'emergencyContacts',
    'insurance',
    'registrationStatus',
    'registrationDate',
    'profileCompleteness'
  ];
  
  // Remove any fields not in the allowed list
  Object.keys(data).forEach(key => {
    if (!allowedFields.includes(key)) {
      delete data[key];
    }
  });
  
  // Remove sensitive insurance fields
  if (data.insurance) {
    delete data.insurance.policyNumber;
    delete data.insurance.groupNumber;
  }
}

/**
 * Filter data for patient role
 * @private
 * @param {Object} data - Response data to filter
 * @param {string} userId - User ID of the patient
 */
function filterPatientView(data, userId) {
  // Patients can see their own data, but we might want to filter
  // specific notes or medical interpretations
  
  // Example: Hide certain medical notes or internal comments
  if (data.medicalHistory) {
    data.medicalHistory.forEach(item => {
      // Hide internal provider notes if present
      if (item.internalNotes) delete item.internalNotes;
    });
  }
  
  if (data.appointments) {
    data.appointments.forEach(appointment => {
      // Hide provider notes about the patient
      if (appointment.providerNotes) delete appointment.providerNotes;
    });
  }
}

module.exports = fieldVisibilityMiddleware;