// cypress/reporters/custom-reporter.js
// Custom reporter for more readable test reports
// NEW FILE: Custom test reporter with healthcare-specific formatting

const mocha = require('mocha');
const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_SUITE_BEGIN, EVENT_SUITE_END } = mocha.Runner.constants;

// Custom reporter extending Mocha's base reporter
class CustomReporter {
  constructor(runner) {
    this.indent = 0;
    this.passes = 0;
    this.failures = 0;
    this.total = 0;
    this.journeyStats = {};
    
    runner.on(EVENT_RUN_BEGIN, () => {
      console.log('Starting Healthcare User Journey Tests\n');
      console.log('=========================================');
    });
    
    runner.on(EVENT_SUITE_BEGIN, (suite) => {
      if (suite.title) {
        console.log(`${'  '.repeat(this.indent)}➤ ${suite.title}`);
        this.indent++;
        
        // Track journey statistics
        if (suite.title.includes('Journey')) {
          this.journeyStats[suite.title] = {
            total: 0,
            passes: 0,
            failures: 0
          };
        }
      }
    });
    
    runner.on(EVENT_SUITE_END, (suite) => {
      if (suite.title) {
        this.indent--;
      }
    });
    
    runner.on(EVENT_TEST_PASS, (test) => {
      this.passes++;
      this.total++;
      
      console.log(`${'  '.repeat(this.indent)}✅ ${test.title}`);
      
      // Update journey stats
      this._updateJourneyStats(test, 'passes');
    });
    
    runner.on(EVENT_TEST_FAIL, (test, err) => {
      this.failures++;
      this.total++;
      
      console.log(`${'  '.repeat(this.indent)}❌ ${test.title}`);
      console.log(`${'  '.repeat(this.indent + 1)}Error: ${err.message}`);
      
      // Update journey stats
      this._updateJourneyStats(test, 'failures');
    });
    
    runner.on(EVENT_RUN_END, () => {
      console.log('\n=========================================');
      console.log('User Journey Test Results:');
      
      // Print journey-specific stats
      Object.entries(this.journeyStats).forEach(([journey, stats]) => {
        const passRate = stats.total ? Math.round((stats.passes / stats.total) * 100) : 0;
        console.log(`\n${journey}:`);
        console.log(`  Total Steps: ${stats.total}`);
        console.log(`  Passed: ${stats.passes}`);
        console.log(`  Failed: ${stats.failures}`);
        console.log(`  Pass Rate: ${passRate}%`);
      });
      
      // Print overall stats
      const overallPassRate = this.total ? Math.round((this.passes / this.total) * 100) : 0;
      console.log('\nOverall Results:');
      console.log(`  Total Tests: ${this.total}`);
      console.log(`  Passed: ${this.passes}`);
      console.log(`  Failed: ${this.failures}`);
      console.log(`  Overall Pass Rate: ${overallPassRate}%`);
      console.log('=========================================');
    });
  }
  
  // Helper to update journey statistics
  _updateJourneyStats(test, resultType) {
    // Find which journey this test belongs to
    const journeyParent = this._findJourneyParent(test);
    if (journeyParent) {
      this.journeyStats[journeyParent].total++;
      this.journeyStats[journeyParent][resultType]++;
    }
  }
  
  // Find the journey parent of a test
  _findJourneyParent(test) {
    let suite = test.parent;
    
    while (suite) {
      if (suite.title && suite.title.includes('Journey')) {
        return suite.title;
      }
      suite = suite.parent;
    }
    
    return null;
  }
}

module.exports = CustomReporter;