/**
 * Metric Model
 * 
 * This model stores application metrics for tracking and reporting purposes.
 * It captures test coverage, performance data, and defect metrics.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MetricSchema = new Schema(
  {
    // Metric type (coverage, performance, defects, etc.)
    type: {
      type: String,
      required: true,
      enum: ['coverage', 'performance', 'defect', 'usage', 'security']
    },
    
    // Date of metric collection
    collectedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    
    // Git info
    git: {
      commit: String,
      branch: String,
      tag: String
    },
    
    // Test coverage data
    coverage: {
      statements: {
        total: Number,
        covered: Number,
        percentage: Number
      },
      branches: {
        total: Number,
        covered: Number,
        percentage: Number
      },
      functions: {
        total: Number,
        covered: Number,
        percentage: Number
      },
      lines: {
        total: Number,
        covered: Number,
        percentage: Number
      }
    },
    
    // Performance metrics
    performance: {
      endpoint: String,
      requestsPerSecond: Number,
      averageLatency: Number,
      p95Latency: Number,
      p99Latency: Number,
      errorRate: Number,
      timeoutRate: Number
    },
    
    // Defect metrics
    defect: {
      total: Number,
      open: Number,
      closed: Number,
      critical: Number,
      high: Number,
      medium: Number,
      low: Number,
      averageResolutionTime: Number, // in hours
      oldestOpenDefect: Number // in days
    },
    
    // Security metrics
    security: {
      vulnerabilitiesFound: Number,
      criticalVulnerabilities: Number,
      highVulnerabilities: Number,
      mediumVulnerabilities: Number,
      lowVulnerabilities: Number,
      fixedVulnerabilities: Number
    },
    
    // Usage metrics
    usage: {
      activeUsers: Number,
      totalRequests: Number,
      uniqueEndpoints: Number,
      averageResponseTime: Number,
      errorCount: Number
    },
    
    // Raw data support for flexible metric storage
    rawData: {
      type: Schema.Types.Mixed
    },
    
    // Source of the metric (CI, manual, scheduled, etc)
    source: {
      type: String,
      enum: ['ci', 'manual', 'scheduled', 'production', 'integration'],
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
MetricSchema.index({ type: 1, collectedAt: 1 });
MetricSchema.index({ 'git.commit': 1 });
MetricSchema.index({ 'git.branch': 1 });

// Methods to calculate derived metrics
MetricSchema.methods.getTotalCoverage = function() {
  if (!this.coverage) return 0;
  
  const statementsWeight = 0.25;
  const branchesWeight = 0.25;
  const functionsWeight = 0.25;
  const linesWeight = 0.25;
  
  return (
    (this.coverage.statements?.percentage || 0) * statementsWeight +
    (this.coverage.branches?.percentage || 0) * branchesWeight +
    (this.coverage.functions?.percentage || 0) * functionsWeight +
    (this.coverage.lines?.percentage || 0) * linesWeight
  );
};

const Metric = mongoose.model('Metric', MetricSchema);

module.exports = Metric;