(function () {
  "use strict";

  const data = window.HutaoWorksData || {};
  const works = Array.isArray(data.works) ? data.works : [];
  const logs = Array.isArray(data.logs) ? data.logs : [];
  const categories = Array.isArray(data.categories) && data.categories.length
    ? data.categories
    : ["全部"];
  const toolbar = document.querySelector("#worksToolbar");
  const grid = document.querySelector("#worksGrid");
  const logList = document.querySelector("#worksLogList");
  let active = "全部";

  function createWorkCard(work) {
    const card = document.createElement("article");
    card.className = "work-card reveal";

    const cover = document.createElement(work.demo ? "a" : "div");
    cover.className = "work-cover";
    if (work.demo) {
      cover.href = work.demo;
      cover.setAttribute("aria-label", `进入${work.title}`);
    }
    if (work.cover) {
      const image = document.createElement("img");
      image.src = work.cover;
      image.alt = "";
      image.loading = "lazy";
      cover.appendChild(image);
    } else {
      const mark = document.createElement("span");
      mark.textContent = "卷";
      cover.appendChild(mark);
    }

    const copy = document.createElement("div");
    copy.className = "work-copy";
    const category = document.createElement("small");
    category.textContent = work.category;
    const title = document.createElement("h2");
    if (work.demo) {
      const titleLink = document.createElement("a");
      titleLink.href = work.demo;
      titleLink.textContent = work.title;
      title.appendChild(titleLink);
    } else {
      title.textContent = work.title;
    }
    const description = document.createElement("p");
    description.textContent = work.description;
    const tech = document.createElement("div");
    tech.className = "work-tech";
    work.tech.forEach((item) => {
      const chip = document.createElement("span");
      chip.textContent = item;
      tech.appendChild(chip);
    });
    const actions = document.createElement("div");
    actions.className = "work-actions";
    if (work.demo) {
      const demo = document.createElement("a");
      demo.href = work.demo;
      demo.textContent = work.demoLabel || "在线体验";
      actions.appendChild(demo);
    }
    if (work.source) {
      const source = document.createElement("a");
      source.href = work.source;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = "源码";
      actions.appendChild(source);
    }

    copy.append(category, title, description, tech, actions);
    card.append(cover, copy);
    return card;
  }

  function renderWorks() {
    const filtered = active === "全部" ? works : works.filter((work) => work.category === active);
    grid.replaceChildren();
    if (!filtered.length) {
      const state = document.createElement("p");
      state.className = "works-state";
      state.textContent = "这个分类还没有可确认的公开作品，先把卷宗留在这里，等素材齐了再补。";
      grid.appendChild(state);
      return;
    }
    filtered.forEach((work) => grid.appendChild(createWorkCard(work)));
    grid.querySelectorAll(".reveal").forEach((node) => window.MotionCore?.revealInserted(node));
  }

  function renderToolbar() {
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;
      button.classList.toggle("active", category === active);
      button.addEventListener("click", () => {
        active = category;
        toolbar.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
        renderWorks();
      });
      toolbar.appendChild(button);
    });
  }

  function renderLogs() {
    logs.forEach((item) => {
      const article = document.createElement("article");
      article.className = "works-log-item reveal";
      article.innerHTML = `<time datetime="${item.date}">${item.date}</time><div><h3></h3><p></p></div>`;
      article.querySelector("h3").textContent = item.title;
      article.querySelector("p").textContent = item.description;
      logList.appendChild(article);
    });
  }

  renderToolbar();
  renderWorks();
  renderLogs();
}());
