(() => {
  "use strict";

  const STORAGE_KEY = "hutao-house-state-v3";
  const clamp = (value) => Math.min(100, Math.max(0, value));
  const today = () => new Date().toLocaleDateString("sv-SE");
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function setupEntryScene() {
    const entry = $("#petEntry");
    if (!entry) return () => {};

    const bar = $("#petEntryBar");
    const number = $("#petEntryNumber");
    const status = $("#petEntryStatus");
    const skip = $("#petEntrySkip");
    const replay = $("#petEntryReplay");
    const seenKey = "hutao-pet-entry-seen";
    const hasSeenEntry = sessionStorage.getItem(seenKey) === "true";
    const startedAt = performance.now();
    const minimumDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 240
      : hasSeenEntry
        ? 420
        : 2600;
    let assetsReady = false;
    let finished = false;
    let progress = 0;

    const leave = () => {
      if (finished) return;
      finished = true;
      sessionStorage.setItem(seenKey, "true");
      bar.style.width = "100%";
      number.textContent = "100";
      status.textContent = "已到胡桃小屋";
      entry.classList.add("is-leaving");
      document.body.classList.remove("pet-entry-active");
      window.setTimeout(() => entry.remove(), 420);
    };

    const tick = () => {
      if (finished) return;
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(1, elapsed / minimumDuration);
      const target = 5 + (1 - Math.pow(1 - ratio, 2.2)) * 95;
      progress += Math.max(0.45, (target - progress) * 0.14);
      progress = Math.min(100, progress);
      const rounded = Math.floor(progress);
      bar.style.width = `${progress}%`;
      number.textContent = String(rounded);

      if (rounded > 72) status.textContent = assetsReady ? "马上就好" : "正在唤醒角色";
      else if (rounded > 38) status.textContent = "正在备好茶点";

      if (elapsed >= minimumDuration) {
        leave();
        return;
      }
      window.requestAnimationFrame(tick);
    };

    skip.addEventListener("click", leave);
    replay?.addEventListener("click", () => {
      sessionStorage.removeItem(seenKey);
      window.location.reload();
    });
    window.requestAnimationFrame(tick);
    return () => {
      assetsReady = true;
    };
  }

  const markEntryReady = setupEntryScene();

  const defaults = {
    hunger: 78,
    mood: 84,
    energy: 76,
    xp: 0,
    level: 1,
    coins: 20,
    lastGift: "",
    motion: true,
    sound: true,
    deepNight: false,
    daily: { date: "", completed: [] },
  };

  let state = loadState();
  let rig = null;
  let busy = false;
  let audioContext = null;
  let toastTimer = 0;
  let drag = null;
  let stageOffset = { x: 0, y: 0 };
  let characterKey = "hutao";
  let modelLoading = false;
  const characterOrder = ["hutao", "fireman", "zhang"];

  const characters = {
    hutao: {
      name: "小桃",
      relation: "亲密伙伴",
      modelUrl: "./assets/models/HutaoSeethrough/seethrough_output.model3.json",
      scale: 0.8,
      y: 0.52,
      welcome: "这次真的醒过来啦！移动光标看看？",
      actions: {
        pet: ["嘿嘿，再摸一下也不是不行。", "帽子可不能揉乱啦！"],
        feed: ["唔，这个味道不错！", "吃饱才有力气工作嘛。"],
        play: ["抓到你啦！再来一次！", "今天的胜负可还没定呢。"],
        dance: ["一二三，跟上本堂主的节拍！", "这支舞就当今日特别演出。"],
        sleep: ["只眯一小会儿……呼……", "午后的阳光最适合打盹。"],
        wave: ["我一直都看见你哦！", "嗨！今天也要开心。"],
      },
    },
    fireman: {
      name: "季沧海",
      relation: "登门访客",
      modelUrl: "./assets/models/Fireman/Fireman.model3.json",
      scale: 0.8,
      y: 0.52,
      welcome: "听说这里有好酒好茶，我便来串个门。",
      actions: {
        pet: ["哈哈，胆子不小。", "这份热情，我记下了。"],
        feed: ["不错，再来一碗。", "有酒有肉，才叫痛快。"],
        play: ["来，痛痛快快比一场！", "这点热身还不够尽兴。"],
        dance: ["烈火随心，步子自然也要豪迈。", "今日兴起，便舞上一回。"],
        sleep: ["养足精神，再战不迟。", "我先歇片刻，酒可别收走。"],
        wave: ["季沧海，前来拜访。", "有朋在此，岂能不来？"],
      },
    },
    zhang: {
      name: "张起灵",
      relation: "沉默访客",
      modelUrl: "./assets/models/Zhang/Zhang.model3.json",
      scale: 0.8,
      y: 0.52,
      welcome: "我来了。这里，很安静。",
      actions: {
        pet: ["……别闹。", "嗯。"],
        feed: ["谢谢。", "够了。"],
        play: ["跟上。", "动作要快。"],
        dance: ["不太擅长。", "只一次。"],
        sleep: ["我守着。", "休息吧。"],
        wave: ["张起灵。", "我在。"],
      },
    },
  };

  const actionData = {
    pet: { mood: 8, energy: -1, xp: 5, sound: 540 },
    feed: { hunger: 14, mood: 3, coins: -2, xp: 6, sound: 650 },
    play: { mood: 7, energy: -8, hunger: -3, xp: 8, sound: 760 },
    dance: { mood: 12, energy: -7, xp: 9, sound: 820 },
    sleep: { energy: 16, hunger: -3, xp: 4, sound: 330 },
    wave: { mood: 4, xp: 5, sound: 710 },
  };

  const voiceLibrary = window.PET_VOICE_LIBRARY || {};
  let voiceUnlocked = false;
  let pendingWelcomeVoice = null;

  function getVoiceEntry(role, action) {
    return voiceLibrary?.[role]?.actions?.[action] || characters[role]?.actions?.[action];
  }

  function getSystemVoice(key) {
    return voiceLibrary?.hutao?.system?.[key];
  }

  function getWelcomeVoice(role) {
    return voiceLibrary?.[role]?.welcome || characters[role]?.welcome;
  }

  function chooseRandomLine(lines) {
    if (!Array.isArray(lines)) return lines;
    if (!lines.length) return "";
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function normalizeSpeechEntry(value) {
    const picked = chooseRandomLine(value);
    if (picked && typeof picked === "object") {
      return {
        text: String(picked.text || ""),
        audio: typeof picked.audio === "string" && picked.audio ? picked.audio : "",
      };
    }
    return { text: String(picked || ""), audio: "" };
  }

  function fallbackSpeechDuration(text) {
    return Math.min(5.2, Math.max(1.4, [...String(text)].length * 0.16));
  }

  function safeRigSpeak(duration) {
    const safeDuration = Math.min(12, Math.max(0.3, Number(duration) || 0));
    if (safeDuration > 0) rig?.speak(safeDuration);
  }

  class VoiceController {
    constructor() {
      this.audio = new Audio();
      this.audio.preload = "metadata";
      this.playToken = 0;
      this.currentSource = "";
      this.warnedSources = new Set();
      this.audio.addEventListener("ended", () => { this.currentSource = ""; });
      this.audio.addEventListener("error", () => { this.currentSource = ""; });
      this.audio.addEventListener("abort", () => { this.currentSource = ""; });
      this.audio.addEventListener("emptied", () => { this.currentSource = ""; });
    }

    stop() {
      this.playToken += 1;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.currentSource = "";
      safeRigSpeak(0.3);
    }

    waitForMetadata(token) {
      return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = 0;
        const settle = (callback, value) => {
          if (settled) return;
          settled = true;
          cleanup();
          callback(value);
        };
        const cleanup = () => {
          if (timeoutId) window.clearTimeout(timeoutId);
          this.audio.removeEventListener("loadedmetadata", onLoaded);
          this.audio.removeEventListener("error", onError);
          this.audio.removeEventListener("abort", onAbort);
          this.audio.removeEventListener("emptied", onAbort);
        };
        const onLoaded = () => {
          settle(resolve, { cancelled: token !== this.playToken });
        };
        const onError = () => {
          settle(reject, new Error("Audio metadata failed"));
        };
        const onAbort = () => {
          settle(resolve, { cancelled: true });
        };
        if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
          resolve({ cancelled: token !== this.playToken });
          return;
        }
        this.audio.addEventListener("loadedmetadata", onLoaded, { once: true });
        this.audio.addEventListener("error", onError, { once: true });
        this.audio.addEventListener("abort", onAbort, { once: true });
        this.audio.addEventListener("emptied", onAbort, { once: true });
        timeoutId = window.setTimeout(() => {
          settle(resolve, { cancelled: token !== this.playToken });
        }, 1200);
      });
    }

    warnOnce(source, error) {
      if (this.warnedSources.has(source)) return;
      this.warnedSources.add(source);
      console.warn("Character voice could not be played:", source, error);
    }

    async play(source) {
      if (!source) return { ok: false, duration: 0 };
      this.stop();
      const token = this.playToken;
      this.currentSource = source;
      this.audio.src = source;
      try {
        const playPromise = this.audio.play().catch((error) => ({ voicePlayError: error }));
        const metadata = await this.waitForMetadata(token);
        if (metadata?.cancelled) return { ok: false, duration: 0 };
        if (token !== this.playToken) return { ok: false, duration: 0 };
        const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0
          ? Math.min(12, Math.max(0.3, this.audio.duration))
          : 0;
        const playResult = await playPromise;
        if (playResult?.voicePlayError) throw playResult.voicePlayError;
        if (token !== this.playToken) return { ok: false, duration: 0 };
        return { ok: true, duration };
      } catch (error) {
        if (token === this.playToken) this.warnOnce(source, error);
        return { ok: false, duration: 0 };
      }
    }
  }

  const voiceController = new VoiceController();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const result = { ...defaults, ...saved };
      for (const key of ["hunger", "mood", "energy", "xp"]) result[key] = Number.isFinite(result[key]) ? Math.min(key === "xp" ? 99 : 100, Math.max(0, result[key])) : defaults[key];
      for (const key of ["coins", "level"]) result[key] = Number.isSafeInteger(result[key]) ? Math.max(key === "level" ? 1 : 0, result[key]) : defaults[key];
      for (const key of ["sound", "motion"]) result[key] = typeof result[key] === "boolean" ? result[key] : defaults[key];
      result.deepNight = false;
      return result;
    } catch (_) {
      return { ...defaults };
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_) { showToast("浏览器未允许保存，当前进度将在离开后丢失"); }
  }

  function updateUI() {
    $("#hungerValue").textContent = Math.round(state.hunger);
    $("#moodValue").textContent = Math.round(state.mood);
    $("#energyValue").textContent = Math.round(state.energy);
    $("#hungerBar").style.width = `${state.hunger}%`;
    $("#moodBar").style.width = `${state.mood}%`;
    $("#energyBar").style.width = `${state.energy}%`;
    $("#petLevel").textContent = state.level;
    $("#petCoins").textContent = state.coins;
    $("#petXpText").textContent = `${state.xp} / 100`;
    $("#petXpBar").style.width = `${state.xp}%`;

    const gift = $("#dailyGift");
    const claimed = state.lastGift === today();
    gift.disabled = claimed;
    gift.querySelector("strong").textContent = claimed ? "今日已领取" : "领取 10 枚桃花币";
    setToggle($("#motionToggle"), state.motion, `动态：${state.motion ? "开" : "关"}`);
    setToggle($("#soundToggle"), state.sound, `音效：${state.sound ? "开" : "关"}`);
    $("#petCondition").textContent = state.energy < 15 ? "有点累了，歇一歇吧" : state.hunger < 30 ? "肚子饿了，来份点心" : state.mood < 40 ? "想和你一起玩" : "状态很好 · 今日小礼";
    updateDailyTasks();
  }

  function ensureDaily() {
    if (state.daily?.date !== today() || !Array.isArray(state.daily?.completed)) state.daily = { date: today(), completed: [] };
  }

  function updateDailyTasks() {
    ensureDaily();
    const tasks = $$("[data-task]");
    const count = tasks.filter(button => state.daily.completed.includes(button.dataset.task)).length;
    $("#dailyProgress").textContent = count + " / 3 完成";
    $("#taskTabCount").textContent = count + " / 3";
    tasks.forEach(button => {
      const done = state.daily.completed.includes(button.dataset.task);
      button.classList.toggle("is-complete", done);
      button.querySelector("em").textContent = done ? "已完成 ✓" : "去完成";
      button.disabled = done || busy || modelLoading;
    });
  }

  function completeDaily(action) {
    if (!["pet", "play", "sleep"].includes(action) || state.daily.completed.includes(action)) return false;
    state.daily.completed.push(action);
    state.coins += 4;
    showToast("今日小事完成 · 获得 4 枚桃花币");
    return true;
  }

  function refreshAvailability() {
    $$("[data-action], .companion-list [data-character], #visitToggle, #retryModel").forEach(button => { button.disabled = busy || modelLoading; });
    updateDailyTasks();
  }

  function setToggle(button, active, label) {
    button.classList.toggle("is-on", active);
    button.setAttribute("aria-pressed", String(active));
    button.querySelector(".button-label").textContent = label;
    const type = button.id === "motionToggle" ? "motion" : "sound";
    button.querySelector("img").src = `./assets/pet-cottage/ui/03_settings/${type}_${active ? "on" : "off"}.png`;
  }

  function addValue(key, amount) {
    if (!amount) return;
    if (key === "coins") state.coins = Math.max(0, state.coins + amount);
    else if (key === "xp") {
      state.xp += amount;
      while (state.xp >= 100) {
        state.xp -= 100;
        state.level += 1;
        state.coins += 12;
        showToast(`亲密等级提升到 Lv.${state.level}`);
      }
    } else state[key] = clamp(state[key] + amount);
  }

  async function speak(value, options = {}) {
    const entry = normalizeSpeechEntry(value);
    const line = entry.text;
    const speech = $("#petSpeech");
    speech.animate([{ opacity: 0.2, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
    speech.textContent = line;
    $("#speakerName").textContent = options.speaker || characters[characterKey]?.name || "小桃";
    const fallbackDuration = fallbackSpeechDuration(line);
    if (options.deferAudio) {
      pendingWelcomeVoice = { role: characterKey, entry };
      safeRigSpeak(fallbackDuration);
      return entry;
    }
    const canPlayVoice = state.sound && entry.audio && (voiceUnlocked || options.allowAutoplay);
    if (!canPlayVoice) {
      safeRigSpeak(fallbackDuration);
      return entry;
    }
    const result = await voiceController.play(entry.audio);
    safeRigSpeak(result.duration || fallbackDuration);
    return entry;
  }

  function speakCharacter(value, options = {}) {
    return speak(value, { ...options, speaker: characters[characterKey]?.name });
  }

  function speakSystemMessage(value, options = {}) {
    if (characterKey === "hutao" && options.hutaoVoice !== false) {
      return speak(value, { ...options, speaker: characters.hutao.name });
    }
    return speak(value?.text || value, { ...options, speaker: "小屋提示" });
  }

  function unlockVoice(options = {}) {
    voiceUnlocked = true;
    if (options.discardWelcome) pendingWelcomeVoice = null;
  }

  function playPendingWelcome() {
    if (!pendingWelcomeVoice || pendingWelcomeVoice.role !== characterKey || !state.sound) return false;
    const entry = pendingWelcomeVoice.entry;
    pendingWelcomeVoice = null;
    speak(entry, { speaker: characters[characterKey]?.name });
    return true;
  }

  function showToast(message) {
    const toast = $("#petToast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function makeSparks(x, y, count = 8) {
    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement("i");
      spark.className = "pet-spark";
      spark.textContent = index % 2 ? "✦" : "·";
      spark.style.left = `${x + (Math.random() - 0.5) * 42}px`;
      spark.style.top = `${y + (Math.random() - 0.5) * 28}px`;
      spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 90}px`);
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 850);
    }
  }

  function playSound(frequency = 620) {
    if (!state.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, audioContext.currentTime + 0.11);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.055, audioContext.currentTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.17);
    } catch (_) {
      state.sound = false;
      updateUI();
    }
  }

  function runAction(name, source) {
    if (busy || modelLoading || !actionData[name]) return;
    ensureDaily();
    if (["play", "dance"].includes(name) && state.energy < Math.abs(actionData[name].energy)) {
      showToast("精力不够啦，先休息一下再来玩");
      return;
    }
    unlockVoice({ discardWelcome: true });
    const data = actionData[name];
    if (data.coins && state.coins + data.coins < 0) {
      speakSystemMessage(characterKey === "hutao" ? getSystemVoice("coinsEmpty") : "桃花币不够啦，先领取今日小礼吧。");
      showToast("桃花币不足");
      return;
    }

    busy = true;
    refreshAvailability();
    speakCharacter(getVoiceEntry(characterKey, name));
    playSound(data.sound);
    const rect = (source || $("#petCharacter")).getBoundingClientRect();
    makeSparks(rect.left + rect.width / 2, rect.top + rect.height * 0.42, name === "dance" ? 14 : 8);

    ["hunger", "mood", "energy", "xp", "coins"].forEach((key) => addValue(key, data[key]));
    const reward = completeDaily(name);
    saveState();
    updateUI();
    const feedback = Object.entries(data).filter(([key]) => ["mood", "hunger", "energy", "xp", "coins"].includes(key)).map(([key, value]) => `${({ mood: "心情", hunger: "饱食", energy: "精力", xp: "经验", coins: "桃花币" })[key]} ${value > 0 ? "+" : ""}${value}`).join(" · ");
    $("#actionFeedback").textContent = reward ? `${feedback} · 今日小事 +4币` : feedback;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      busy = false;
      refreshAvailability();
    };
    setTimeout(finish, 3200);
    if (!rig?.play(name, finish)) {
      $("#petCharacter").animate(
        [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-24px) scale(1.02)" }, { transform: "translateY(0) scale(1)" }],
        { duration: 700, easing: "ease-out" },
      ).onfinish = finish;
    }
  }

  function setClock() {
    const date = new Date();
    updateUI();
    $("#petClock").textContent = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const hour = date.getHours();
    $("#petGreeting").textContent = hour < 6 ? "夜深相伴" : hour < 12 ? "早安相伴" : hour < 18 ? "午后相伴" : "晚间相伴";
    $("#petDayText").textContent = hour < 6 ? "还没睡吗？我陪你守一会儿夜" : hour < 12 ? "往生堂今日也准时开门" : hour < 18 ? "窗外阳光正好，适合偷闲" : "灯笼亮起来了，欢迎回家";
  }

  function bindDragging() {
    const character = $("#petCharacter");
    character.addEventListener("click", event => { if (event.detail === 0) runAction("pet", character); });
    character.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: stageOffset.x, originY: stageOffset.y, moved: false };
      character.setPointerCapture(event.pointerId);
    });
    character.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 7;
      const limit = Math.min(220, $("#petRoom").clientWidth * 0.18);
      stageOffset.x = Math.max(-limit, Math.min(limit, drag.originX + dx));
      stageOffset.y = Math.max(-115, Math.min(110, drag.originY + dy));
      $("#petStage").style.transform = `translate3d(${stageOffset.x}px, ${stageOffset.y}px, 0)`;
    });
    character.addEventListener("pointerup", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved) runAction("pet", character);
      drag = null;
    });
    character.addEventListener("pointercancel", () => { drag = null; });
  }

  function updateCharacterUI() {
    const character = characters[characterKey];
    const visiting = characterKey !== "hutao";
    const nextKey = characterOrder[(characterOrder.indexOf(characterKey) + 1) % characterOrder.length];
    const nextCharacter = characters[nextKey];
    $$(".companion-list [data-character]").forEach((button) => {
      const selected = button.dataset.character === characterKey;
      button.setAttribute("aria-pressed", String(selected));
      button.querySelector("em").textContent = selected ? "在小屋" : "邀请";
    });
    $("#profileName").textContent = character.name;
    $("#profileRelation").textContent = character.relation;
    $("#speakerName").textContent = character.name;
    $("#petCharacter").setAttribute("aria-label", `与${character.name}互动，按住可以拖动`);
    $("#petRoom").classList.toggle("is-visitor", visiting);
    $("#profileAvatarImage").src = `./assets/pet-cottage/avatars/${characterKey}.png`;
    $("#petFallback").src = `./assets/pet-cottage/fallbacks/${characterKey}.png`;
    $("#petFallback").alt = `${character.name}备用立绘`;
    const visitToggle = $("#visitToggle");
    visitToggle.classList.toggle("is-active", visiting);
    visitToggle.setAttribute("aria-pressed", String(visiting));
    visitToggle.querySelector(".visit-label").textContent = nextKey === "hutao" ? "送客" : "串门";
    visitToggle.querySelector("strong").textContent = nextKey === "hutao" ? `请${character.name}下次再来` : `邀请${nextCharacter.name}来坐坐`;
  }

  async function loadCharacter(nextKey, initial = false) {
    if (modelLoading || !characters[nextKey]) return;
    modelLoading = true;
    refreshAvailability();
    const status = $("#modelStatus");
    const character = characters[nextKey];
    const host = $("#petRig");
    // Keep the current rig alive until its replacement is ready.
    const nextHost = document.createElement("span");
    nextHost.className = "pet-rig";
    nextHost.style.visibility = "hidden";
    nextHost.innerHTML = '<span class="pet-canvas"></span>';
    host.after(nextHost);
    const candidate = new HutaoRig(nextHost, { modelUrl: character.modelUrl, scale: character.scale, y: character.y });
    $("#petRoom").classList.add("is-switching-character");
    status.classList.remove("is-ready", "is-error");
    $("#retryModel").hidden = true;
    status.querySelector("span").textContent = character.name + "正在登门…";
    try {
      await candidate.init();
      voiceController.stop();
      rig?.destroy();
      host.replaceWith(nextHost);
      nextHost.id = "petRig";
      nextHost.style.visibility = "";
      rig = candidate;
      $("#petRoom").classList.add("has-live2d");
      characterKey = nextKey;
      updateCharacterUI();
      rig.setMotion(state.motion);
      status.classList.add("is-ready");
      status.querySelector("span").textContent = character.name + "已到 · Live2D 运行中";
      pendingWelcomeVoice = null;
      speak(getWelcomeVoice(nextKey), { speaker: character.name, deferAudio: initial && !voiceUnlocked });
    } catch (error) {
      console.warn("[pet-room] Character load failed:", nextKey, error);
      candidate.destroy();
      nextHost.remove();
      if (!rig) { characterKey = nextKey; updateCharacterUI(); }
      status.classList.add("is-error");
      status.querySelector("span").textContent = character.name + "加载失败" + (rig ? "，当前角色继续相伴" : "，可重试加载");
      const retry = $("#retryModel");
      retry.hidden = false;
      retry.dataset.character = nextKey;
      showToast("角色未能到访，请重试");
    } finally {
      modelLoading = false;
      $("#petRoom").classList.remove("is-switching-character");
      refreshAvailability();
      if (initial) markEntryReady();
    }
  }

  function initRig() {
    return loadCharacter("hutao", true);
  }

  function bindControls() {
    $$("[data-action]").forEach((button) => button.addEventListener("click", () => runAction(button.dataset.action, button)));
    $("#dailyGift").addEventListener("click", (event) => {
      unlockVoice({ discardWelcome: true });
      if (state.lastGift === today()) return;
      state.lastGift = today();
      state.coins += 10;
      state.mood = clamp(state.mood + 5);
      saveState();
      updateUI();
      playSound(880);
      const rect = event.currentTarget.getBoundingClientRect();
      makeSparks(rect.left + rect.width / 2, rect.top, 14);
      speakSystemMessage(characterKey === "hutao" ? getSystemVoice("gift") : "今日份的桃花币，收好啦！");
      showToast("获得 10 枚桃花币");
    });
    $("#motionToggle").addEventListener("click", () => {
      unlockVoice({ discardWelcome: true });
      state.motion = !state.motion;
      rig?.setMotion(state.motion);
      saveState();
      updateUI();
      speakSystemMessage(characterKey === "hutao" ? getSystemVoice(state.motion ? "motionOn" : "motionOff") : state.motion ? "好啦，我继续活动活动。" : "那我先安静地待一会儿。");
    });
    $("#soundToggle").addEventListener("click", () => {
      unlockVoice();
      state.sound = !state.sound;
      if (!state.sound) voiceController.stop();
      saveState();
      updateUI();
      if (state.sound) playSound(700);
    });
    $("#visitToggle").addEventListener("click", () => {
      if (busy || modelLoading) return;
      unlockVoice({ discardWelcome: true });
      loadCharacter(characterOrder[(characterOrder.indexOf(characterKey) + 1) % characterOrder.length]);
    });
    $$(".companion-list [data-character]").forEach(button => button.addEventListener("click", () => {
      if (busy || modelLoading || button.dataset.character === characterKey) return;
      unlockVoice({ discardWelcome: true });
      loadCharacter(button.dataset.character);
    }));
    $("#retryModel").addEventListener("click", event => loadCharacter(event.currentTarget.dataset.character));
    $$("[data-task]").forEach(button => button.addEventListener("click", () => runAction(button.dataset.task, button)));
    $("#resetPosition").addEventListener("click", () => {
      unlockVoice({ discardWelcome: true });
      stageOffset = { x: 0, y: 0 };
      $("#petStage").style.transform = "translate3d(0, 0, 0)";
      speakSystemMessage(characterKey === "hutao" ? getSystemVoice("reset") : "又回到最舒服的位置啦。");
    });
    $("#petRoom").addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea, [data-action], #petCharacter")) return;
      unlockVoice();
      playPendingWelcome();
    });
  }

  function bindJournalTabs() {
    const tabs = $$(".journal-tabs [role=tab]");
    const select = (selected) => tabs.forEach(tab => {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
    });
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[next]); tabs[next].focus();
      });
    });
  }

  function init() {
    updateCharacterUI();
    updateUI();
    setClock();
    setInterval(setClock, 30000);
    bindControls();
    bindJournalTabs();
    bindDragging();
    window.addEventListener("pointermove", (event) => {
      if (!drag) rig?.trackPointer(event.clientX, event.clientY);
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => rig?.resetGaze());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        rig?.resetGaze();
        voiceController.stop();
      }
    });
    window.addEventListener("beforeunload", () => voiceController.stop());
    initRig();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
