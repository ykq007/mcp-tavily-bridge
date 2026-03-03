/**
 * Credit cost calculation for Tavily operations
 * Based on Tavily API pricing documentation
 */

export type OperationType = 'search' | 'extract' | 'crawl' | 'map' | 'research';

export interface OperationParams {
  search_depth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  extract_depth?: 'basic' | 'advanced';
  urls?: string[];
  max_depth?: number;
  limit?: number;
  model?: 'mini' | 'pro' | 'auto';
}

interface CreditCost {
  min: number;
  max: number;
  estimated: number;
}

/**
 * Calculate credit cost for a Tavily operation
 * Returns estimated credits required based on operation type and parameters
 */
export function calculateOperationCost(operation: OperationType, params: OperationParams = {}): CreditCost {
  switch (operation) {
    case 'search':
      return calculateSearchCost(params);
    case 'extract':
      return calculateExtractCost(params);
    case 'crawl':
      return calculateCrawlCost(params);
    case 'map':
      return calculateMapCost(params);
    case 'research':
      return calculateResearchCost(params);
    default:
      return { min: 1, max: 1, estimated: 1 };
  }
}

/**
 * Check if an operation is considered "expensive" (should be blocked when credits are low)
 */
export function isExpensiveOperation(operation: OperationType): boolean {
  return operation === 'crawl' || operation === 'research';
}

function calculateSearchCost(params: OperationParams): CreditCost {
  const depth = params.search_depth || 'basic';

  // Basic/fast/ultra-fast: 1 credit
  // Advanced: 2 credits
  if (depth === 'advanced') {
    return { min: 2, max: 2, estimated: 2 };
  }

  return { min: 1, max: 1, estimated: 1 };
}

function calculateExtractCost(params: OperationParams): CreditCost {
  const depth = params.extract_depth || 'basic';
  const urlCount = Array.isArray(params.urls) ? params.urls.length : 1;

  // Basic: 0.2 credits per URL
  // Advanced: 0.4 credits per URL
  const costPerUrl = depth === 'advanced' ? 0.4 : 0.2;
  const totalCost = costPerUrl * urlCount;

  return {
    min: totalCost,
    max: totalCost,
    estimated: totalCost
  };
}

function calculateMapCost(params: OperationParams): CreditCost {
  // Map operation: 0.1-0.2 credits per page
  // Estimate based on limit parameter (default 50)
  const limit = params.limit !== undefined ? Math.max(0, params.limit) : 50;
  const maxDepth = params.max_depth || 1;

  // Conservative estimate: 0.15 credits per page on average
  const estimatedPages = Math.min(limit, 50);
  const costPerPage = 0.15;
  const totalCost = costPerPage * estimatedPages;

  return {
    min: costPerPage * Math.min(limit, 10),
    max: costPerPage * limit,
    estimated: totalCost
  };
}

function calculateCrawlCost(params: OperationParams): CreditCost {
  // Crawl = Map + Extract
  // Map cost + Extract cost per page
  const mapCost = calculateMapCost(params);

  const extractDepth = params.extract_depth || 'basic';
  const limit = params.limit || 50;
  const extractCostPerPage = extractDepth === 'advanced' ? 0.4 : 0.2;

  const estimatedPages = Math.min(limit, 50);
  const extractTotal = extractCostPerPage * estimatedPages;

  const totalMin = mapCost.min + (extractCostPerPage * Math.min(limit, 10));
  const totalMax = mapCost.max + (extractCostPerPage * limit);
  const totalEstimated = mapCost.estimated + extractTotal;

  return {
    min: totalMin,
    max: totalMax,
    estimated: totalEstimated
  };
}

function calculateResearchCost(params: OperationParams): CreditCost {
  const model = params.model || 'auto';

  // Research costs are highly variable based on:
  // - Number of searches performed
  // - Number of pages extracted
  // - Depth of research

  // Conservative estimates based on typical usage:
  // Mini: 10-50 credits (narrow tasks, few subtopics)
  // Pro: 50-200 credits (broad tasks, many subtopics)
  // Auto: 10-200 credits (depends on task complexity)

  if (model === 'mini') {
    return { min: 10, max: 50, estimated: 25 };
  } else if (model === 'pro') {
    return { min: 50, max: 200, estimated: 100 };
  } else {
    // Auto mode - use middle ground
    return { min: 10, max: 200, estimated: 50 };
  }
}
