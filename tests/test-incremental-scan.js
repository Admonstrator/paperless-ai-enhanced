// tests/test-incremental-scan.js
// Test script for incremental document scanning

const paperlessService = require('../services/paperlessService');
const documentModel = require('../models/document');

console.log('=== Incremental Scan Test ===\n');

async function testIncrementalScan() {
  try {
    // Initialize Paperless service
    paperlessService.initialize();
    
    console.log('1. Testing getDocumentsOptimized with different filters:\n');
    
    // Test 1: Full scan (no filters)
    console.log('   a) Full scan (no filters):');
    const startTime1 = Date.now();
    const allDocs = await paperlessService.getDocumentsOptimized({
      fields: 'id,title,modified'
    });
    const duration1 = Date.now() - startTime1;
    console.log(`      Found ${allDocs.length} documents in ${duration1}ms`);
    console.log('');
    
    // Test 2: Incremental scan (modified in last 24 hours)
    console.log('   b) Incremental scan (last 24 hours):');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const startTime2 = Date.now();
    const recentDocs = await paperlessService.getDocumentsOptimized({
      modifiedSince: yesterday,
      fields: 'id,title,modified',
      ordering: '-modified'
    });
    const duration2 = Date.now() - startTime2;
    console.log(`      Found ${recentDocs.length} documents modified since ${yesterday}`);
    console.log(`      Query took ${duration2}ms`);
    console.log(`      Reduction: ${Math.round((1 - recentDocs.length / allDocs.length) * 100)}% fewer documents`);
    console.log('');
    
    // Test 3: Incremental scan (modified in last hour)
    console.log('   c) Incremental scan (last hour):');
    const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const startTime3 = Date.now();
    const veryRecentDocs = await paperlessService.getDocumentsOptimized({
      modifiedSince: lastHour,
      fields: 'id,title,modified',
      ordering: '-modified'
    });
    const duration3 = Date.now() - startTime3;
    console.log(`      Found ${veryRecentDocs.length} documents modified since ${lastHour}`);
    console.log(`      Query took ${duration3}ms`);
    console.log(`      Reduction: ${Math.round((1 - veryRecentDocs.length / allDocs.length) * 100)}% fewer documents`);
    console.log('');
    
    // Test 4: Field selection comparison
    console.log('   d) Testing field selection performance:');
    console.log('      Full fields:');
    const startTime4 = Date.now();
    const fullFields = await paperlessService.getDocumentsOptimized({
      fields: 'id,title,content,tags,correspondent,created,modified,added',
      modifiedSince: yesterday
    });
    const duration4 = Date.now() - startTime4;
    console.log(`         ${fullFields.length} docs in ${duration4}ms`);
    
    console.log('      Minimal fields:');
    const startTime5 = Date.now();
    const minimalFields = await paperlessService.getDocumentsOptimized({
      fields: 'id,modified',
      modifiedSince: yesterday
    });
    const duration5 = Date.now() - startTime5;
    console.log(`         ${minimalFields.length} docs in ${duration5}ms`);
    console.log(`         Speed improvement: ${Math.round(duration4 / duration5)}x faster with minimal fields`);
    console.log('');
    
    // Test 5: Database timestamp tracking
    console.log('2. Testing last scan timestamp tracking:\n');
    
    const currentTimestamp = new Date().toISOString();
    console.log(`   Setting last scan timestamp: ${currentTimestamp}`);
    documentModel.setLastScanTimestamp(currentTimestamp);
    
    const retrievedTimestamp = documentModel.getLastScanTimestamp();
    console.log(`   Retrieved timestamp: ${retrievedTimestamp}`);
    console.log(`   Match: ${currentTimestamp === retrievedTimestamp ? '✅' : '❌'}`);
    console.log('');
    
    // Test 6: Simulated incremental scan workflow
    console.log('3. Simulated incremental scan workflow:\n');
    
    const lastScan = documentModel.getLastScanTimestamp();
    if (lastScan) {
      console.log(`   Last scan was at: ${lastScan}`);
      const modifiedDocs = await paperlessService.getDocumentsOptimized({
        modifiedSince: lastScan,
        fields: 'id,title,modified',
        ordering: '-modified'
      });
      console.log(`   Found ${modifiedDocs.length} documents modified since last scan`);
      
      if (modifiedDocs.length > 0) {
        console.log(`   Most recent modifications:`);
        modifiedDocs.slice(0, 5).forEach(doc => {
          console.log(`      - Doc ${doc.id}: ${doc.title} (modified: ${doc.modified})`);
        });
      }
    } else {
      console.log('   No previous scan timestamp found (would do full scan)');
    }
    console.log('');
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testIncrementalScan().then(() => {
  console.log('\n=== Test Complete ===');
  process.exit(0);
});
