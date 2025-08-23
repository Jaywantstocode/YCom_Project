/**
 * Test script for Product Hunt search functionality
 */

import { searchProductHunt } from '../src/lib/tools/search-products';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testSearchProducts() {
  console.log('🚀 Starting Product Hunt search tests...\n');
  
  // Test cases with the new queries array format
  const testCases = [
    {
      name: 'Single query search',
      params: {
        queries: ['productivity tools'],
        limit: 5,
        useSemanticSearch: true,
      },
    },
    {
      name: 'Multiple queries search',
      params: {
        queries: [
          'AI writing assistant',
          'time tracking software',
          'project management tool'
        ],
        limit: 3,
        useSemanticSearch: true,
      },
    },
    {
      name: 'Text search fallback',
      params: {
        queries: ['session tracker', 'productivity booster'],
        limit: 3,
        useSemanticSearch: false,
      },
    },
    {
      name: 'Semantic search with natural language',
      params: {
        queries: [
          'tools for managing time and tasks',
          'AI-powered productivity enhancement',
          'automated workflow optimization'
        ],
        limit: 5,
        useSemanticSearch: true,
      },
    },
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log('Parameters:', testCase.params);
    console.log('-'.repeat(50));
    
    try {
      const result = await searchProductHunt.execute(testCase.params);
      
      if (result.success) {
        console.log(`✅ Success! Searched ${result.totalQueries} queries`);
        console.log(`Search method: ${result.searchMethod}`);
        
        // Display results for each query
        result.results.forEach((queryResult: any) => {
          console.log(`\n🔍 Query: "${queryResult.query}"`);
          console.log(`   Found ${queryResult.products.length} products`);
          
          queryResult.products.forEach((product: any, index: number) => {
            console.log(`\n   ${index + 1}. ${product.name}`);
            console.log(`      📝 ${product.tagline}`);
            console.log(`      🔗 ${product.url || 'No URL'}`);
            console.log(`      🏷️  Tags: ${product.tags?.join(', ') || 'None'}`);
            console.log(`      📊 Score: ${product.score.toFixed(3)}`);
            if (product.searchType) {
              console.log(`      🔍 Search type: ${product.searchType}`);
            }
          });
        });
      } else {
        console.error('❌ Search failed:', result.message);
      }
    } catch (error) {
      console.error('❌ Error during test:', error);
    }
  }
  
  console.log('\n\n✨ All tests completed!');
}

// Run the tests
testSearchProducts().catch(console.error);