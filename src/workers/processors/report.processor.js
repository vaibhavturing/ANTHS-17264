// src/workers/processors/report.processor.js
const Bull = require('bull');
const queueConfig = require('../../config/queue.config');
const logger = require('../../utils/logger');
const Patient = require('../../models/patient.model');
const MedicalRecord = require('../../models/medicalRecord.model');
const Appointment = require('../../models/appointment.model');
const User = require('../../models/user.model');
const fs = require('fs').promises;
const path = require('path');
const emailService = require('../../services/email.service');

// Initialize queue
const reportQueue = new Bull(queueConfig.queues.REPORT, {
  redis: queueConfig.redis,
  defaultJobOptions: queueConfig.defaultJobOptions
});

/**
 * Generate patient statistics report
 * @param {Object} data - Report parameters
 * @returns {Promise<Object>} Generated report data
 */
async function generatePatientStatisticsReport(data) {
  logger.info('Generating patient statistics report');
  
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
  
  // Get total patient count
  const totalPatients = await Patient.countDocuments({ status: 'active' });
  
  // Get new patient count in last 6 months
  const newPatients = await Patient.countDocuments({
    status: 'active',
    createdAt: { $gte: sixMonthsAgo }
  });
  
  // Get patient demographics
  const genderStats = await Patient.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$gender', count: { $sum: 1 } } },
    { $project: { gender: '$_id', count: 1, _id: 0 } }
  ]);
  
  // Get patients by age group
  const now2 = new Date();
  const ageStats = await Promise.all([
    // 0-17
    Patient.countDocuments({
      status: 'active',
      dateOfBirth: { $gte: new Date(now2.getFullYear() - 17, now2.getMonth(), now2.getDate()) }
    }),
    // 18-35
    Patient.countDocuments({
      status: 'active',
      dateOfBirth: {
        $lt: new Date(now2.getFullYear() - 17, now2.getMonth(), now2.getDate()),
        $gte: new Date(now2.getFullYear() - 35, now2.getMonth(), now2.getDate())
      }
    }),
    // 36-50
    Patient.countDocuments({
      status: 'active',
      dateOfBirth: {
        $lt: new Date(now2.getFullYear() - 35, now2.getMonth(), now2.getDate()),
        $gte: new Date(now2.getFullYear() - 50, now2.getMonth(), now2.getDate())
      }
    }),
    // 51-65
    Patient.countDocuments({
      status: 'active',
      dateOfBirth: {
        $lt: new Date(now2.getFullYear() - 50, now2.getMonth(), now2.getDate()),
        $gte: new Date(now2.getFullYear() - 65, now2.getMonth(), now2.getDate())
      }
    }),
    // 65+
    Patient.countDocuments({
      status: 'active',
      dateOfBirth: { $lt: new Date(now2.getFullYear() - 65, now2.getMonth(), now2.getDate()) }
    })
  ]);
  
  // Format into a report object
  return {
    generatedAt: new Date().toISOString(),
    reportType: 'Patient Statistics',
    data: {
      totalPatients,
      newPatients,
      genderDistribution: genderStats,
      ageDistribution: [
        { group: '0-17', count: ageStats[0] },
        { group: '18-35', count: ageStats[1] },
        { group: '36-50', count: ageStats[2] },
        { group: '51-65', count: ageStats[3] },
        { group: '65+', count: ageStats[4] }
      ]
    }
  };
}

/**
 * Generate appointment statistics report
 * @param {Object} data - Report parameters
 * @returns {Promise<Object>} Generated report data
 */
async function generateAppointmentStatisticsReport(data) {
  logger.info('Generating appointment statistics report');
  
  const { startDate, endDate } = data;
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate ? new Date(endDate) : new Date();
  
  // Get total appointments in date range
  const totalAppointments = await Appointment.countDocuments({
    scheduledTime: { $gte: start, $lte: end }
  });
  
  // Get appointment counts by status
  const statusStats = await Appointment.aggregate([
    { $match: { scheduledTime: { $gte: start, $lte: end } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } }
  ]);
  
  // Get appointment counts by type
  const typeStats = await Appointment.aggregate([
    { $match: { scheduledTime: { $gte: start, $lte: end } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $project: { type: '$_id', count: 1, _id: 0 } }
  ]);
  
  // Get appointment counts per day
  const dailyStats = await Appointment.aggregate([
    { $match: { scheduledTime: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', count: 1, _id: 0 } }
  ]);
  
  return {
    generatedAt: new Date().toISOString(),
    reportType: 'Appointment Statistics',
    parameters: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    data: {
      totalAppointments,
      statusDistribution: statusStats,
      typeDistribution: typeStats,
      dailyDistribution: dailyStats
    }
  };
}

/**
 * Generate doctor workload report
 * @param {Object} data - Report parameters
 * @returns {Promise<Object>} Generated report data
 */
async function generateDoctorWorkloadReport(data) {
  logger.info('Generating doctor workload report');
  
  const { startDate, endDate } = data;
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate ? new Date(endDate) : new Date();
  
  // Get appointment counts per doctor
  const doctorWorkload = await Appointment.aggregate([
    { $match: { scheduledTime: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$doctor',
        totalAppointments: { $sum: 1 },
        completedAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'doctorInfo'
      }
    },
    { $unwind: '$doctorInfo' },
    {
      $project: {
        _id: 0,
        doctorId: '$_id',
        name: { $concat: ['$doctorInfo.firstName', ' ', '$doctorInfo.lastName'] },
        specialty: '$doctorInfo.specialty',
        totalAppointments: 1,
        completedAppointments: 1,
        cancelledAppointments: 1,
        completionRate: {
          $multiply: [
            { $divide: ['$completedAppointments', { $max: ['$totalAppointments', 1] }] },
            100
          ]
        }
      }
    },
    { $sort: { totalAppointments: -1 } }
  ]);
  
  return {
    generatedAt: new Date().toISOString(),
    reportType: 'Doctor Workload',
    parameters: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    data: {
      doctors: doctorWorkload
    }
  };
}

/**
 * Save report to file system and email it
 * @param {Object} report - Report data
 * @param {Object} jobData - Job data
 * @returns {Promise<Object>} Result information
 */
async function saveAndEmailReport(report, jobData) {
  const { reportType, emailTo } = jobData;
  
  // Create report filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${reportType.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`;
  
  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), 'reports');
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (error) {
    logger.error(`Error creating reports directory:`, error);
  }
  
  // Save report to file
  const filePath = path.join(reportsDir, filename);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  
  // Send email if recipient specified
  if (emailTo) {
    await emailService.sendEmail({
      to: emailTo,
      subject: `${report.reportType} Report`,
      template: 'report-ready',
      context: {
        reportType: report.reportType,
        generatedAt: new Date(report.generatedAt).toLocaleString(),
        reportSummary: `This report contains ${Object.keys(report.data).length} data sections.`
      },
      attachments: [
        {
          filename,
          path: filePath
        }
      ]
    });
  }
  
  return {
    reportSaved: true,
    filePath,
    emailSent: Boolean(emailTo)
  };
}

/**
 * Start the report processor
 * @param {number} workerId - Worker ID
 */
function start(workerId) {
  // Process patient statistics report job
  reportQueue.process('patient-statistics', queueConfig.concurrency.REPORT, async (job) => {
    logger.info(`Worker ${workerId} processing patient statistics report job ${job.id}`);
    
    try {
      // Generate report
      const report = await generatePatientStatisticsReport(job.data);
      
      // Save and email
      const result = await saveAndEmailReport(report, job.data);
      
      return {
        ...result,
        report
      };
    } catch (error) {
      logger.error(`Error processing patient statistics report job ${job.id}:`, error);
      throw error;
    }
  });
  
  // Process appointment statistics report job
  reportQueue.process('appointment-statistics', queueConfig.concurrency.REPORT, async (job) => {
    logger.info(`Worker ${workerId} processing appointment statistics report job ${job.id}`);
    
    try {
      // Generate report
      const report = await generateAppointmentStatisticsReport(job.data);
      
      // Save and email
      const result = await saveAndEmailReport(report, job.data);
      
      return {
        ...result,
        report
      };
    } catch (error) {
      logger.error(`Error processing appointment statistics report job ${job.id}:`, error);
      throw error;
    }
  });
  
  // Process doctor workload report job
  reportQueue.process('doctor-workload', queueConfig.concurrency.REPORT, async (job) => {
    logger.info(`Worker ${workerId} processing doctor workload report job ${job.id}`);
    
    try {
      // Generate report
      const report = await generateDoctorWorkloadReport(job.data);
      
      // Save and email
      const result = await saveAndEmailReport(report, job.data);
      
      return {
        ...result,
        report
      };
    } catch (error) {
      logger.error(`Error processing doctor workload report job ${job.id}:`, error);
      throw error;
    }
  });
  
  // Handle completed jobs
  reportQueue.on('completed', (job, result) => {
    logger.info(`Worker ${workerId} completed job ${job.id} with result:`, result);
  });
  
  // Handle failed jobs
  reportQueue.on('failed', (job, error) => {
    logger.error(`Worker ${workerId} job ${job.id} failed:`, error);
  });
  
  logger.info(`Worker ${workerId} started report processor`);
}

/**
 * Stop the report processor
 */
async function stop() {
  await reportQueue.close();
}

module.exports = {
  queue: reportQueue,
  start,
  stop
};