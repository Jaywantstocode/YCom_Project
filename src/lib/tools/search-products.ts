/**
 * Tool for searching Product Hunt products
 */

import { z } from 'zod';

// Product Hunt API configuration
const PRODUCT_HUNT_API_URL = 'https://api.producthunt.com/v2/api/graphql';
const PRODUCT_HUNT_TOKEN = process.env.PRODUCT_HUNT_ACCESS_TOKEN;

// GraphQL query for searching products
const SEARCH_PRODUCTS_QUERY = `
  query searchProducts($query: String!, $first: Int!) {
    posts(first: $first, order: VOTES, search: $query) {
      edges {
        node {
          id
          name
          tagline
          description
          votesCount
          commentsCount
          url
          website
          createdAt
          topics {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    }
  }
`;

// Tool definition
export const searchProductHunt = {
  description: 'Search for products on Product Hunt',
  parameters: z.object({
    query: z.string().describe('Product search query'),
    category: z.string().optional().describe('Product category filter'),
  }),
  execute: async ({ query, category }: { query: string; category?: string }) => {
    try {
      console.log('Searching Product Hunt:', { query, category });
      
      // If no token, return mock data
      if (!PRODUCT_HUNT_TOKEN) {
        console.log('Product Hunt token not configured, returning mock data');
        return {
          success: true,
          products: [
            {
              id: 'mock-1',
              name: 'Productivity Booster',
              tagline: 'Boost your productivity 10x',
              votesCount: 100,
              url: 'https://producthunt.com/posts/productivity-booster'
            },
            {
              id: 'mock-2',
              name: 'Session Tracker Pro',
              tagline: 'Track and analyze your work sessions',
              votesCount: 85,
              url: 'https://producthunt.com/posts/session-tracker-pro'
            }
          ],
          message: `Mock results for: ${query}`
        };
      }
      
      // Make actual API call to Product Hunt
      const response = await fetch(PRODUCT_HUNT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRODUCT_HUNT_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: SEARCH_PRODUCTS_QUERY,
          variables: {
            query: category ? `${query} ${category}` : query,
            first: 10
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Product Hunt API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform the response
      const products = data.data?.posts?.edges?.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name,
        tagline: edge.node.tagline,
        description: edge.node.description,
        votesCount: edge.node.votesCount,
        commentsCount: edge.node.commentsCount,
        url: edge.node.url,
        website: edge.node.website,
        topics: edge.node.topics?.edges?.map((t: any) => t.node.name) || []
      })) || [];
      
      return {
        success: true,
        products,
        message: `Found ${products.length} products on Product Hunt for: ${query}`
      };
    } catch (error) {
      console.error('Error searching Product Hunt:', error);
      return {
        success: false,
        products: [],
        message: `Failed to search Product Hunt: ${error}`
      };
    }
  },
};