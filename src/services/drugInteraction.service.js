const Medication = require('../models/medication.model');
const Patient = require('../models/patient.model');
const Allergy = require('../models/allergy.model');

class DrugInteractionService {
  /**
   * Check for drug-drug interactions
   * @param {Array} medicationIds - Array of medication IDs to check
   * @returns {Promise<Array>} Array of interaction warnings
   */
  async checkDrugInteractions(medicationIds) {
    try {
      const interactions = [];
      
      // Get all medications
      const medications = await Medication.find({
        _id: { $in: medicationIds }
      });
      
      // Build a map of medication IDs to their documents
      const medicationMap = medications.reduce((map, med) => {
        map[med._id.toString()] = med;
        return map;
      }, {});
      
      // Check each medication against every other medication
      for (let i = 0; i < medicationIds.length; i++) {
        const med1Id = medicationIds[i];
        const med1 = medicationMap[med1Id.toString()];
        
        if (!med1) continue;
        
        // Check this medication against all other medications in the list
        for (let j = i + 1; j < medicationIds.length; j++) {
          const med2Id = medicationIds[j];
          const med2 = medicationMap[med2Id.toString()];
          
          if (!med2) continue;
          
          // Check if med1 has interactions with med2
          const med1Interactions = med1.interactions || [];
          const interaction1 = med1Interactions.find(
            int => int.interactsWith.toString() === med2Id.toString()
          );
          
          // Check if med2 has interactions with med1
          const med2Interactions = med2.interactions || [];
          const interaction2 = med2Interactions.find(
            int => int.interactsWith.toString() === med1Id.toString()
          );
          
          // Take the more severe interaction if both exist
          if (interaction1 || interaction2) {
            let interactionToUse;
            
            if (interaction1 && interaction2) {
              // Use the more severe interaction
              const severityOrder = {
                'mild': 1,
                'moderate': 2,
                'severe': 3,
                'contraindicated': 4
              };
              
              interactionToUse = severityOrder[interaction1.severity] >= severityOrder[interaction2.severity]
                ? interaction1
                : interaction2;
            } else {
              interactionToUse = interaction1 || interaction2;
            }
            
            interactions.push({
              medicationIds: [med1Id, med2Id],
              severity: interactionToUse.severity,
              description: interactionToUse.description
            });
          }
        }
      }
      
      return interactions;
    } catch (error) {
      throw new Error(`Error checking drug interactions: ${error.message}`);
    }
  }
  
  /**
   * Check for drug-allergy interactions
   * @param {String} patientId - Patient ID
   * @param {Array} medicationIds - Array of medication IDs to check
   * @returns {Promise<Array>} Array of allergy warnings
   */
  async checkAllergyInteractions(patientId, medicationIds) {
    try {
      // Get patient's allergies
      const allergies = await Allergy.find({
        patient: patientId,
        allergenType: 'medication',
        isActive: true
      });
      
      if (!allergies.length) return [];
      
      // Get medications
      const medications = await Medication.find({
        _id: { $in: medicationIds }
      });
      
      const allergyWarnings = [];
      
      // Check each medication against patient allergies
      for (const medication of medications) {
        for (const allergy of allergies) {
          // Direct medication allergy
          if (allergy.medicationId && 
              allergy.medicationId.toString() === medication._id.toString()) {
            allergyWarnings.push({
              allergyId: allergy._id,
              medicationId: medication._id,
              severity: 'contraindicated',
              description: `Patient is allergic to ${medication.name} with reaction: ${allergy.reaction}`
            });
            continue;
          }
          
          // Check for class allergies
          if (allergy.allergenClass && 
              medication.classification === allergy.allergenClass) {
            allergyWarnings.push({
              allergyId: allergy._id,
              medicationId: medication._id,
              severity: 'severe',
              description: `Patient has an allergy to drug class ${allergy.allergenClass} which includes ${medication.name}`
            });
            continue;
          }
          
          // Future enhancement: Check for ingredient allergies if medication contains multiple ingredients
        }
      }
      
      return allergyWarnings;
    } catch (error) {
      throw new Error(`Error checking allergy interactions: ${error.message}`);
    }
  }
  
  /**
   * Comprehensive check for all interactions
   * @param {String} patientId - Patient ID
   * @param {Array} medicationIds - Array of medication IDs to check
   * @returns {Promise<Object>} Object containing drug and allergy interactions
   */
  async checkAllInteractions(patientId, medicationIds) {
    try {
      const [drugInteractions, allergyInteractions] = await Promise.all([
        this.checkDrugInteractions(medicationIds),
        this.checkAllergyInteractions(patientId, medicationIds)
      ]);
      
      return {
        drugInteractions,
        allergyInteractions
      };
    } catch (error) {
      throw new Error(`Error checking interactions: ${error.message}`);
    }
  }
}

module.exports = new DrugInteractionService();