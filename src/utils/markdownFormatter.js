/**
 * Utility function to format markdown-like text for better display in React components
 * Converts common markdown syntax to styled HTML elements
 */
export function formatMarkdown(text) {
  if (!text) return '';
  
  return text
    // Convert **bold** to <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    // Convert ### headers to styled headers
    .replace(/### (.*?)(?=\n|$)/g, '<h3 class="text-lg font-semibold text-gray-800 mt-4 mb-2 border-b border-gray-200 pb-1">$1</h3>')
    // Convert ## headers to styled headers
    .replace(/## (.*?)(?=\n|$)/g, '<h2 class="text-xl font-bold text-gray-900 mt-6 mb-3 border-b-2 border-gray-300 pb-2">$1</h2>')
    // Convert # headers to styled headers
    .replace(/^# (.*?)(?=\n|$)/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4 border-b-2 border-blue-500 pb-2">$1</h1>')
    // Convert bullet points to styled lists
    .replace(/^- (.*?)(?=\n|$)/gm, '<li class="ml-4 mb-1 text-gray-700">• $1</li>')
    // Convert numbered lists
    .replace(/^(\d+)\. (.*?)(?=\n|$)/gm, '<li class="ml-4 mb-1 text-gray-700"><span class="font-semibold text-blue-600">$1.</span> $2</li>')
    // Convert line breaks
    .replace(/\n\n/g, '</p><p class="mb-3 text-gray-700">')
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph tags
    .replace(/^(.*)$/, '<p class="mb-3 text-gray-700">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p class="mb-3 text-gray-700"><\/p>/g, '')
    // Wrap lists in proper containers
    .replace(/(<li class="ml-4 mb-1 text-gray-700">.*<\/li>)/gs, '<ul class="list-none space-y-1 my-3">$1</ul>')
    // Clean up nested list tags
    .replace(/<\/ul><ul class="list-none space-y-1 my-3">/g, '');
}
