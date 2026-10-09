/**
 * Touch Target Audit Script
 * Audits all interactive elements in frontend/src/ for 48x48px compliance.
 */

import fs from 'node:fs';
import path from 'node:path';

const filesToAudit = [
  'frontend/src/App.tsx',
  'frontend/src/views/ClinicianQueueView.tsx',
  'frontend/src/views/KioskIntakeView.tsx',
  'frontend/src/components/LanguageSelector.tsx',
  'frontend/src/components/EmergencyAlertModal.tsx',
  'frontend/src/components/DocumentScanner.tsx',
  'frontend/src/components/AyushSahayakAvatar.tsx',
  'frontend/src/components/KioskStepperHeader.tsx',
  'frontend/src/components/NanoBanner.tsx',
  'frontend/src/components/ErrorBoundary.tsx'
];

console.log('=== SYSTEMATIC AUDIT OF TOUCH TARGETS (48x48px) ===\n');

// Helper to determine if className has min 48px height and width
function checkTouchTargetClasses(className) {
  if (!className) return { heightOk: false, widthOk: false, reason: 'No className' };

  const tokens = className.split(/\s+/).filter(Boolean);

  // Height check:
  // min-h-[48px], min-h-[72px], min-h-[80px], min-h-[96px], min-h-12, min-h-14, min-h-16, h-12, h-14, h-16, h-[48px]...
  const heightOk = tokens.some(t => {
    if (/^min-h-(\[(\d+)px\]|12|14|16|20|24|28|32)/.test(t)) {
      const match = t.match(/min-h-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    if (/^h-(\[(\d+)px\]|12|14|16|20|24|28|32)/.test(t)) {
      const match = t.match(/h-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    return false;
  });

  // Width check:
  // min-w-[48px], min-w-12, w-full, w-1/2, w-1/3, w-2/3, w-14, w-16, px-4, px-5, px-6, px-8, etc.
  const widthOk = tokens.some(t => {
    if (/^min-w-(\[(\d+)px\]|12|14|16|20|24|28|32)/.test(t)) {
      const match = t.match(/min-w-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    if (/^w-(full|1\/2|1\/3|2\/3|3\/4|\[(\d+)px\]|12|14|16|20|24|28|32)/.test(t)) {
      const match = t.match(/w-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    if (/^px-([4-9]|\d{2,})/.test(t)) return true; // px-4 = 32px padding, with text easily > 48px
    if (t === 'flex-1') return true;
    return false;
  });

  return { heightOk, widthOk, tokens };
}

/**
 * Accurately parses opening JSX tags by handling quotes and nested braces.
 */
function extractOpeningTags(content) {
  const tags = [];
  let i = 0;
  const n = content.length;

  while (i < n) {
    if (content[i] === '<') {
      const nextChar = content[i + 1];
      // Only proceed if next character is a letter (valid JSX element start)
      if (nextChar && /[a-zA-Z]/.test(nextChar) && content.substring(i, i + 4) !== '<!--') {
        const tagStartIndex = i;
        i++;
        let tagName = '';
        while (i < n && /[a-zA-Z0-9_]/.test(content[i])) {
          tagName += content[i];
          i++;
        }

        let attrStart = i;
        let braceDepth = 0;
        let inSingle = false;
        let inDouble = false;
        let inTemplate = false;
        let isEscaped = false;

        while (i < n) {
          const char = content[i];

          if (isEscaped) {
            isEscaped = false;
            i++;
            continue;
          }

          if (char === '\\') {
            isEscaped = true;
            i++;
            continue;
          }

          if (inSingle) {
            if (char === "'") inSingle = false;
            i++;
            continue;
          }
          if (inDouble) {
            if (char === '"') inDouble = false;
            i++;
            continue;
          }
          if (inTemplate) {
            if (char === '`') inTemplate = false;
            i++;
            continue;
          }

          if (char === "'") {
            inSingle = true;
            i++;
            continue;
          }
          if (char === '"') {
            inDouble = true;
            i++;
            continue;
          }
          if (char === '`') {
            inTemplate = true;
            i++;
            continue;
          }

          if (char === '{') {
            braceDepth++;
            i++;
            continue;
          }
          if (char === '}') {
            if (braceDepth > 0) braceDepth--;
            i++;
            continue;
          }

          // Found end of opening tag outside of braces and strings
          if (braceDepth === 0 && char === '>') {
            const rawAttributes = content.substring(attrStart, i);
            tags.push({
              tagName,
              attributes: rawAttributes,
              index: tagStartIndex
            });
            i++;
            break;
          }

          i++;
        }
        continue;
      }
    }
    i++;
  }

  return tags;
}

/**
 * Extracts all class tokens from attributes string
 */
function extractClassNameExpr(attributes) {
  const cnIndex = attributes.indexOf('className=');
  if (cnIndex === -1) return null;
  const afterEqual = attributes.substring(cnIndex + 'className='.length).trimStart();
  if (afterEqual.startsWith('"')) {
    const end = afterEqual.indexOf('"', 1);
    return { type: 'string', content: afterEqual.substring(1, end !== -1 ? end : afterEqual.length) };
  }
  if (afterEqual.startsWith("'")) {
    const end = afterEqual.indexOf("'", 1);
    return { type: 'string', content: afterEqual.substring(1, end !== -1 ? end : afterEqual.length) };
  }
  if (afterEqual.startsWith('{')) {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let esc = false;
    for (let i = 0; i < afterEqual.length; i++) {
      const c = afterEqual[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (inSingle) { if (c === "'") inSingle = false; continue; }
      if (inDouble) { if (c === '"') inDouble = false; continue; }
      if (inTemplate) { if (c === '`') inTemplate = false; continue; }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === '`') { inTemplate = true; continue; }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          return { type: 'expr', content: afterEqual.substring(1, i).trim() };
        }
      }
    }
    return { type: 'expr', content: afterEqual.substring(1).trim() };
  }
  return null;
}

function extractAllClassTokens(attributes) {
  const classTokens = new Set();
  const parsed = extractClassNameExpr(attributes);
  if (!parsed) return '';

  if (parsed.type === 'string') {
    parsed.content.split(/\s+/).forEach(t => t && classTokens.add(t));
  } else if (parsed.type === 'expr') {
    const expr = parsed.content;
    if (expr.startsWith('`') && expr.endsWith('`')) {
      const templateContent = expr.slice(1, -1);
      let depth = 0;
      let staticStr = '';
      const dynamicStrings = [];
      let currentDyn = '';

      for (let i = 0; i < templateContent.length; i++) {
        if (templateContent[i] === '$' && templateContent[i + 1] === '{') {
          depth++;
          i++; // skip {
          continue;
        }
        if (depth > 0) {
          if (templateContent[i] === '{') {
            depth++;
          } else if (templateContent[i] === '}') {
            depth--;
            if (depth === 0) {
              dynamicStrings.push(currentDyn);
              currentDyn = '';
              continue;
            }
          }
          currentDyn += templateContent[i];
        } else {
          staticStr += templateContent[i];
        }
      }

      staticStr.split(/\s+/).forEach(t => t && classTokens.add(t));

      for (const dyn of dynamicStrings) {
        const matches = dyn.match(/(['"`])(.*?)\1/g);
        if (matches) {
          for (const m of matches) {
            m.slice(1, -1).split(/\s+/).forEach(t => t && classTokens.add(t));
          }
        }
      }
    } else {
      const matches = expr.match(/(['"`])(.*?)\1/g);
      if (matches) {
        for (const m of matches) {
          m.slice(1, -1).split(/\s+/).forEach(t => t && classTokens.add(t));
        }
      }
    }
  }

  return Array.from(classTokens).join(' ');
}

let totalInteractive = 0;
let compliantInteractive = 0;
let nonCompliantElements = [];

for (const filePath of filesToAudit) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  console.log(`\n--- Inspecting ${filePath} ---`);

  const tags = extractOpeningTags(content);

  for (const item of tags) {
    const { tagName, attributes, index } = item;

    // Check if hidden or non-visual input
    const isHiddenInput = tagName === 'input' && (
      attributes.includes('type="hidden"') ||
      attributes.includes("type='hidden'") ||
      /\bclassName=(?:["'][^"']*\bhidden\b|`[^`]*\bhidden\b)/.test(attributes)
    );

    if (isHiddenInput) {
      continue;
    }

    const isInteractiveTag = ['button', 'input', 'select', 'textarea'].includes(tagName);
    const hasInteractiveRole = /role=["'](button|radio|checkbox|tab|link)["']/.test(attributes);
    const hasOnClick = /onClick=\{/.test(attributes) && (tagName === 'div' || tagName === 'span' || tagName === 'a');

    if (isInteractiveTag || hasInteractiveRole || hasOnClick) {
      totalInteractive++;

      // Find line number
      const lineNum = content.substring(0, index).split('\n').length;
      const cleanedClass = extractAllClassTokens(attributes);

      const { heightOk, widthOk } = checkTouchTargetClasses(cleanedClass);

      if (heightOk && widthOk) {
        compliantInteractive++;
      } else {
        const issue = [];
        if (!heightOk) issue.push('Height < 48px (missing min-h-[48px] / h-12)');
        if (!widthOk) issue.push('Width < 48px (missing min-w-[48px] / px-4 / w-full)');

        nonCompliantElements.push({
          file: filePath,
          line: lineNum,
          tag: tagName,
          role: hasInteractiveRole ? attributes.match(/role=["']([^"']+)["']/)?.[1] : null,
          issue: issue.join(', '),
          className: cleanedClass.trim()
        });
      }
    }
  }
}

console.log(`\n=== TOUCH TARGET AUDIT SUMMARY ===`);
console.log(`Total Interactive Elements Audited: ${totalInteractive}`);
console.log(`Fully Compliant (>=48x48px): ${compliantInteractive}`);
console.log(`Non-Compliant / Deficient: ${nonCompliantElements.length}`);

if (nonCompliantElements.length > 0) {
  console.log('\n--- Deficient Elements Detail ---');
  for (const item of nonCompliantElements) {
    console.log(`[NON-COMPLIANT] ${item.file}:${item.line} <${item.tag}> (Role: ${item.role || 'none'})`);
    console.log(`  Issue: ${item.issue}`);
    console.log(`  Classes: "${item.className}"\n`);
  }
} else {
  console.log('\n[PASS] All interactive elements satisfy minimum 48x48px touch targets!');
}
