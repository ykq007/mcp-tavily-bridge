import type {
  TavilyCrawlResponse,
  TavilyMapResponse,
  TavilyResearchResponse,
  TavilySearchResponse
} from './types.js';

export function formatResultsV0216(response: TavilySearchResponse): string {
  const output: string[] = [];

  if ((response as any).answer) {
    output.push(`Answer: ${(response as any).answer}`);
  }

  output.push('Detailed Results:');
  for (const result of response.results ?? []) {
    output.push(`\nTitle: ${result.title}`);
    output.push(`URL: ${result.url}`);
    output.push(`Content: ${result.content}`);
    if (result.raw_content) output.push(`Raw Content: ${result.raw_content}`);
    if (result.favicon) output.push(`Favicon: ${result.favicon}`);
  }

  const images = (response as any).images;
  if (Array.isArray(images) && images.length > 0) {
    output.push('\nImages:');
    images.forEach((image: any, index: number) => {
      if (typeof image === 'string') {
        output.push(`\n[${index + 1}] URL: ${image}`);
        return;
      }
      output.push(`\n[${index + 1}] URL: ${image.url}`);
      if (image.description) output.push(`   Description: ${image.description}`);
    });
  }

  return output.join('\n');
}

export function formatCrawlResultsV0216(response: TavilyCrawlResponse): string {
  const output: string[] = [];
  output.push('Crawl Results:');
  output.push(`Base URL: ${response.base_url}`);
  output.push('\nCrawled Pages:');

  response.results.forEach((page, index) => {
    output.push(`\n[${index + 1}] URL: ${page.url}`);
    if (page.raw_content) {
      const contentPreview = page.raw_content.length > 200 ? `${page.raw_content.substring(0, 200)}...` : page.raw_content;
      output.push(`Content: ${contentPreview}`);
    }
    if (page.favicon) output.push(`Favicon: ${page.favicon}`);
  });

  return output.join('\n');
}

export function formatMapResultsV0216(response: TavilyMapResponse): string {
  const output: string[] = [];
  output.push('Site Map Results:');
  output.push(`Base URL: ${response.base_url}`);
  output.push('\nMapped Pages:');
  response.results.forEach((page, index) => {
    output.push(`\n[${index + 1}] URL: ${page}`);
  });
  return output.join('\n');
}

export function formatResearchResultsV0216(response: TavilyResearchResponse): string {
  if (response.error) return `Research Error: ${response.error}`;
  return response.content || 'No research results available';
}

