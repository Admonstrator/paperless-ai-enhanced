// tests/test-metadata-cache.js
// Test script for metadata cache functionality

const metadataCache = require('../services/metadataCache');
const paperlessService = require('../services/paperlessService');

console.log('=== Metadata Cache Test ===\n');

async function testMetadataCache() {
  try {
    // Initialize Paperless service
    paperlessService.initialize();
    
    console.log('1. Initial Cache State:');
    let stats = metadataCache.getStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log('');
    
    // Test 1: First request (should be a MISS)
    console.log('2. First request for tags (expecting MISS):');
    const startTime1 = Date.now();
    const tags1 = await metadataCache.ensureTags(paperlessService);
    const duration1 = Date.now() - startTime1;
    console.log(`   Loaded ${tags1.length} tags in ${duration1}ms`);
    stats = metadataCache.getStats();
    console.log(`   Stats: Hits=${stats.tags.hits}, Misses=${stats.tags.misses}`);
    console.log('');
    
    // Test 2: Second request immediately (should be a HIT)
    console.log('3. Second request for tags (expecting HIT):');
    const startTime2 = Date.now();
    const tags2 = await metadataCache.ensureTags(paperlessService);
    const duration2 = Date.now() - startTime2;
    console.log(`   Got ${tags2.length} tags in ${duration2}ms`);
    stats = metadataCache.getStats();
    console.log(`   Stats: Hits=${stats.tags.hits}, Misses=${stats.tags.misses}`);
    console.log(`   Speed improvement: ${Math.round(duration1 / duration2)}x faster`);
    console.log('');
    
    // Test 3: Correspondents cache
    console.log('4. Testing correspondents cache:');
    const startTime3 = Date.now();
    const correspondents1 = await metadataCache.ensureCorrespondents(paperlessService);
    const duration3 = Date.now() - startTime3;
    console.log(`   First request: ${correspondents1.length} correspondents in ${duration3}ms`);
    
    const startTime4 = Date.now();
    const correspondents2 = await metadataCache.ensureCorrespondents(paperlessService);
    const duration4 = Date.now() - startTime4;
    console.log(`   Second request (cached): ${correspondents2.length} correspondents in ${duration4}ms`);
    console.log(`   Speed improvement: ${Math.round(duration3 / duration4)}x faster`);
    console.log('');
    
    // Test 4: Document types cache
    console.log('5. Testing document types cache:');
    const startTime5 = Date.now();
    const docTypes1 = await metadataCache.ensureDocumentTypes(paperlessService);
    const duration5 = Date.now() - startTime5;
    console.log(`   First request: ${docTypes1.length} document types in ${duration5}ms`);
    
    const startTime6 = Date.now();
    const docTypes2 = await metadataCache.ensureDocumentTypes(paperlessService);
    const duration6 = Date.now() - startTime6;
    console.log(`   Second request (cached): ${docTypes2.length} document types in ${duration6}ms`);
    console.log(`   Speed improvement: ${Math.round(duration5 / duration6)}x faster`);
    console.log('');
    
    // Test 5: Final statistics
    console.log('6. Final Cache Statistics:');
    stats = metadataCache.getStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log('');
    
    // Test 6: Clear cache
    console.log('7. Testing cache clear:');
    metadataCache.clearAll();
    stats = metadataCache.getStats();
    console.log(`   Cache cleared. Tags size: ${stats.tags.size}`);
    console.log('');
    
    // Test 7: Refresh after clear (should be MISS again)
    console.log('8. Request after clear (expecting MISS):');
    const startTime7 = Date.now();
    const tags3 = await metadataCache.ensureTags(paperlessService);
    const duration7 = Date.now() - startTime7;
    console.log(`   Loaded ${tags3.length} tags in ${duration7}ms`);
    stats = metadataCache.getStats();
    console.log(`   Stats: Hits=${stats.tags.hits}, Misses=${stats.tags.misses}`);
    console.log('');
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testMetadataCache().then(() => {
  console.log('\n=== Test Complete ===');
  process.exit(0);
});
