/* Read-only erratum for the public lesson audited on 2026-11-04.
 * Source: ai-from-zero-lesson-018, updated_at 2026-11-04 08:25:19.959268+00.
 * The source contained lost LaTeX backslashes and JS control escapes.
 * Apply only to the exact captured UTF-8 content. Any upstream edit wins.
 * No database writes, network requests, or generic replacement of other articles.
 */
(function () {
  "use strict";
  const slug = "ai-from-zero-lesson-018";
  const sourceHash = "6ea7c6cb0663eea16528d32aeed8679c73b3ad1197352af01c38fc641e3dc81c";
  const corrections = [
    {
      "before": "(V={t_0,t_1,ldots,t_{|V|-1}})",
      "after": "\\(V=\\{t_0,t_1,\\ldots,t_{|V|-1}\\}\\)",
      "count": 1
    },
    {
      "before": "(N)",
      "after": "\\(N\\)",
      "count": 1
    },
    {
      "before": "(d)",
      "after": "\\(d\\)",
      "count": 1
    },
    {
      "before": "[\nEinmathbb R^{N\times d}\n]",
      "after": "\\[\nE\\in\\mathbb{R}^{N\\times d}\n\\]",
      "count": 1
    },
    {
      "before": "(i_1,ldots,i_T)",
      "after": "\\(i_1,\\ldots,i_T\\)",
      "count": 1
    },
    {
      "before": "[\nX_t=E[i_t,:],qquad Xinmathbb R^{T\times d}\n]",
      "after": "\\[\nX_t=E[i_t,:],\\qquad X\\in\\mathbb{R}^{T\\times d}\n\\]",
      "count": 1
    },
    {
      "before": "(10000\times256=2560000)",
      "after": "\\(10000\\times256=2560000\\)",
      "count": 1
    },
    {
      "before": "(e_iinmathbb R^N)",
      "after": "\\(e_i\\in\\mathbb{R}^N\\)",
      "count": 1
    },
    {
      "before": "(i)",
      "after": "\\(i\\)",
      "count": 1
    },
    {
      "before": "[\ne_i^mathsf TE=E[i,:]\n]",
      "after": "\\[\ne_i^{\\mathsf T}E=E[i,:]\n\\]",
      "count": 1
    },
    {
      "before": "(X)",
      "after": "\\(X\\)",
      "count": 2
    },
    {
      "before": "[\nH_0=X+P\n]",
      "after": "\\[\nH_0=X+P\n\\]",
      "count": 1
    },
    {
      "before": "(Pinmathbb R^{T\times d})",
      "after": "\\(P\\in\\mathbb{R}^{T\\times d}\\)",
      "count": 1
    },
    {
      "before": "(X+P)",
      "after": "\\(X+P\\)",
      "count": 1
    },
    {
      "before": "(H_0)",
      "after": "\\(H_0\\)",
      "count": 1
    },
    {
      "before": "((4,4))",
      "after": "\\((4,4)\\)",
      "count": 1
    },
    {
      "before": "((32000,512))",
      "after": "\\((32000,512)\\)",
      "count": 1
    },
    {
      "before": "((128,512))",
      "after": "\\((128,512)\\)",
      "count": 1
    },
    {
      "before": "(16384000\times4=65536000)",
      "after": "\\(16384000\\times4=65536000\\)",
      "count": 1
    },
    {
      "before": "[\n\boxed{\text{文本}\rightarrow\text{分词器}\rightarrow\text{Token ID}\n\rightarrow\text{嵌入向量}\rightarrow\text{位置/上下文处理}}\n]",
      "after": "\\[\n\\boxed{\\begin{gathered}\n\\text{文本}\\rightarrow\\text{分词器}\\rightarrow\\text{Token ID}\\\\\n\\rightarrow\\text{嵌入向量}\\rightarrow\\text{位置/上下文处理}\n\\end{gathered}}\n\\]",
      "count": 1
    }
  ];

  async function prepare(article) {
    if (article?.slug !== slug || typeof article.content !== "string" || !globalThis.crypto?.subtle) return article;
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(article.content));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (hash !== sourceHash) return article;
      let content = article.content;
      for (const { before, after, count } of corrections) {
        if (content.split(before).length - 1 !== count) return article;
        content = content.split(before).join(after);
      }
      return { ...article, content };
    } catch {
      // Rendering must still work if the browser cannot verify the erratum.
      return article;
    }
  }
  window.ArticleContentRepairs = { prepare };
}());

