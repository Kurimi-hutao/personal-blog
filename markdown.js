(function () {
  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function inline(value) {
    const math = [];
    const protectedValue = value.replace(
      /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s)(?:[^$\n]*\S)\$/g,
      (expression) => {
        const token = `HUTAOMATHTOKEN${math.length}END`;
        math.push(expression);
        return token;
      },
    );

    return escapeHtml(protectedValue)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/HUTAOMATHTOKEN(\d+)END/g, (_, index) => escapeHtml(math[Number(index)]));
  }

  function slugify(value, index) {
    const slug = value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
    return slug || `section-${index}`;
  }

  function render(markdown = "") {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let paragraph = [];
    let listType = "";
    let inCode = false;
    let code = [];
    let headingIndex = 0;
    let tableEnd = -1;
    const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (!listType) return;
      output.push(`</${listType}>`);
      listType = "";
    };

    lines.forEach((line, index) => {
      if (index <= tableEnd) return;
      if (line.startsWith("```")) {
        flushParagraph();
        closeList();
        if (inCode) {
          output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
          code = [];
        }
        inCode = !inCode;
        return;
      }
      if (inCode) {
        code.push(line);
        return;
      }

      // Keep wide tables inside their own keyboard-accessible scroll region.
      const headerCells = cells(line);
      const divider = cells(lines[index + 1] || "");
      if (line.includes("|") && divider.length === headerCells.length && divider.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        flushParagraph();
        closeList();
        const align = divider.map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
        const row = (values, tag) => `<tr>${headerCells.map((_, i) => `<${tag}${tag === "th" ? ' scope="col"' : ""} style="text-align:${align[i]}">${inline(values[i] || "")}</${tag}>`).join("")}</tr>`;
        output.push('<div class="article-table-scroll" role="region" aria-label="文章表格，可横向滚动" tabindex="0"><table><thead>', row(headerCells, "th"), '</thead><tbody>');
        tableEnd = index + 1;
        while (tableEnd + 1 < lines.length && lines[tableEnd + 1].includes("|") && lines[tableEnd + 1].trim()) {
          output.push(row(cells(lines[++tableEnd]), "td"));
        }
        output.push('</tbody></table></div>');
        return;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+\.\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        const text = heading[2].trim();
        headingIndex += 1;
        output.push(`<h${level} id="${slugify(text, headingIndex)}">${inline(text)}</h${level}>`);
      } else if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          output.push(`<${listType}>`);
        }
        output.push(`<li>${inline((unordered || ordered)[1])}</li>`);
      } else if (/^>\s?/.test(line)) {
        flushParagraph();
        closeList();
        output.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      } else if (/^---+$/.test(line.trim())) {
        flushParagraph();
        closeList();
        output.push("<hr>");
      } else if (!line.trim()) {
        flushParagraph();
        closeList();
      } else {
        paragraph.push(line.trim());
      }
    });
    flushParagraph();
    closeList();
    if (inCode && code.length) output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    return output.join("");
  }

  window.blogMarkdown = { render };
})();
