(() => {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);

  class HutaoRig {
    constructor(host, options = {}) {
      this.host = host;
      this.options = options;
      this.canvasHost = host.querySelector(".pet-canvas") || host;
      this.modelUrl = options.modelUrl || "./assets/models/HutaoSeethrough/seethrough_output.model3.json";
      this.app = null;
      this.model = null;
      this.ready = false;
      this.enabled = true;
      this.time = 0;
      this.frame = 0;
      this.gaze = { x: 0, y: 0 };
      this.gazeTarget = { x: 0, y: 0 };
      this.action = null;
      this.nextBlink = 2.2;
      this.blinkTime = 0;
      this.blinkCount = 0;
      this.speechUntil = 0;
      this.speechStartedAt = 0;
      this.resizeObserver = null;
      this.tick = this.tick.bind(this);
      this.applyParameters = this.applyParameters.bind(this);
    }

    async init() {
      if (!window.PIXI || !window.PIXI.live2d?.Live2DModel) {
        throw new Error("Live2D runtime is unavailable");
      }

      const canvas = document.createElement("canvas");
      canvas.className = "live2d-canvas";
      canvas.setAttribute("aria-hidden", "true");
      this.canvasHost.replaceChildren(canvas);

      this.app = new PIXI.Application({
        view: canvas,
        resizeTo: this.canvasHost,
        autoDensity: true,
        antialias: true,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });

      const Live2DModel = PIXI.live2d.Live2DModel;
      this.model = await Live2DModel.from(this.modelUrl, {
        autoInteract: false,
        autoUpdate: true,
      });
      this.model.anchor.set(0.5, 0.5);
      this.app.stage.addChild(this.model);
      this.fit();

      this.model.internalModel?.on("beforeModelUpdate", this.applyParameters);
      this.app.ticker.add(this.tick);
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(this.canvasHost);

      this.ready = true;
      this.host.classList.add("is-live2d-ready");
      this.host.dataset.live2d = "ready";
      this.host.dataset.modelUrl = this.modelUrl;
      this.host.dispatchEvent(new CustomEvent("hutao:ready"));
      return this;
    }

    fit() {
      if (!this.model || !this.canvasHost.clientWidth || !this.canvasHost.clientHeight) return;
      this.model.scale.set(1);
      const scale = Math.min(
        this.canvasHost.clientWidth / this.model.width,
        this.canvasHost.clientHeight / this.model.height,
      );
      this.baseScale = scale * (this.options.scale || 0.9);
      this.baseX = this.canvasHost.clientWidth * 0.5;
      this.baseY = this.canvasHost.clientHeight * (this.options.y || 0.51);
      this.model.scale.set(this.baseScale);
      this.model.position.set(this.baseX, this.baseY);
    }

    tick(deltaTime) {
      if (!this.model) return;
      const measuredDelta = this.app?.ticker?.deltaMS;
      const fallbackDelta = typeof deltaTime === "number" ? deltaTime * (1000 / 60) : 1000 / 60;
      const dt = Math.min((Number.isFinite(measuredDelta) ? measuredDelta : fallbackDelta) / 1000, 0.05);
      this.time += dt;
      this.frame += 1;

      const follow = 1 - Math.exp(-dt * 10);
      this.gaze.x = lerp(this.gaze.x, this.gazeTarget.x, follow);
      this.gaze.y = lerp(this.gaze.y, this.gazeTarget.y, follow);

      this.blinkTime += dt;
      if (this.time >= this.nextBlink) {
        this.blinkTime = 0;
        this.blinkCount += 1;
        this.host.dataset.blinkCount = String(this.blinkCount);
        this.nextBlink = this.time + 2.4 + Math.random() * 3.2;
      }

      const pose = this.getPose(dt);
      const idleAmount = this.enabled ? 1 : 0;
      const idleX = Math.sin(this.time * 0.72) * 3.2 * idleAmount;
      const idleY = Math.sin(this.time * 1.55) * 5.4 * idleAmount;
      const idleRotation = Math.sin(this.time * 0.55) * 0.9 * idleAmount;
      const scale = this.baseScale * (1 + Math.sin(this.time * 1.55) * 0.004 * idleAmount + pose.scale);

      this.model.position.set(this.baseX + idleX + pose.x, this.baseY + idleY + pose.y);
      this.model.rotation = ((idleRotation + pose.rotation) * Math.PI) / 180;
      this.model.scale.set(scale * (1 + pose.scaleX), scale * (1 + pose.scaleY));

      if (this.frame % 6 === 0) {
        this.host.dataset.live2dFrames = String(this.frame);
        this.host.dataset.gazeX = this.gaze.x.toFixed(2);
        this.host.dataset.gazeY = this.gaze.y.toFixed(2);
        this.host.dataset.poseY = (idleY + pose.y).toFixed(2);
        this.host.dataset.action = this.action?.name || "idle";
      }
    }

    getPose(dt) {
      const pose = {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 0,
        scaleX: 0,
        scaleY: 0,
        mouth: 0,
        smile: 0,
        cheek: 0,
        eye: 1,
        armR: 0,
        armL: 0,
        bodyBoost: 0,
      };
      if (!this.action) return pose;

      this.action.elapsed += dt;
      const p = clamp(this.action.elapsed / this.action.duration, 0, 1);
      const wave = Math.sin(p * Math.PI);
      const pulse = Math.sin(p * Math.PI * 4);

      switch (this.action.name) {
        case "pet":
          pose.y = Math.sin(p * Math.PI * 2) * 8;
          pose.scaleY = -wave * 0.025;
          pose.scaleX = wave * 0.018;
          pose.smile = wave;
          pose.cheek = wave * 0.8;
          break;
        case "feed":
          pose.y = -wave * 5;
          pose.mouth = Math.max(0, pulse) * 0.9;
          pose.smile = wave * 0.55;
          pose.cheek = wave * 0.45;
          break;
        case "play":
          pose.y = -Math.sin(p * Math.PI) * 66;
          pose.rotation = Math.sin(p * Math.PI * 2) * 5;
          pose.scaleY = Math.sin(p * Math.PI) * 0.025;
          pose.bodyBoost = wave;
          break;
        case "dance":
          pose.x = Math.sin(p * Math.PI * 5) * 25;
          pose.rotation = Math.sin(p * Math.PI * 5) * 7;
          pose.armR = Math.sin(p * Math.PI * 5) * 22;
          pose.armL = -pose.armR * 0.75;
          pose.smile = 0.8;
          pose.bodyBoost = 1;
          break;
        case "sleep":
          pose.y = easeOut(p) * 13;
          pose.rotation = easeOut(p) * 5;
          pose.eye = Math.max(0.08, 1 - wave * 1.25);
          pose.mouth = Math.max(0, Math.sin(p * Math.PI * 3)) * 0.18;
          break;
        case "wave":
          pose.armR = Math.sin(p * Math.PI * 7) * 28;
          pose.rotation = -wave * 2.5;
          pose.smile = wave;
          break;
      }

      if (p >= 1) {
        const done = this.action.done;
        this.action = null;
        this.host.dataset.action = "idle";
        done?.();
      }
      return pose;
    }

    applyParameters() {
      if (!this.model?.internalModel?.coreModel) return;
      const core = this.model.internalModel.coreModel;
      const pose = this.getCurrentParameterPose();
      const idleAmount = this.enabled ? 1 : 0;
      const set = (id, value, weight = 1) => {
        try {
          core.setParameterValueById(id, value, weight);
        } catch (_) {
          // Some exported models omit optional parameters.
        }
      };

      const blink = this.getBlink();
      const eyeOpen = clamp(blink * pose.eye, 0, 1);
      const speechMouth = this.getSpeechMouth();
      const mouthOpen = Math.max(pose.mouth, speechMouth);
      if (this.frame % 6 === 0) {
        this.host.dataset.eyeOpen = eyeOpen.toFixed(2);
        this.host.dataset.mouthOpen = mouthOpen.toFixed(2);
      }
      set("ParamEyeBallX", this.gaze.x);
      set("ParamEyeBallY", -this.gaze.y);
      set("ParamAngleX", this.gaze.x * 22);
      set("ParamAngleY", -this.gaze.y * 16);
      set("ParamAngleZ", Math.sin(this.time * 0.55) * 2.1 * idleAmount + pose.rotation * 0.65);
      set("ParamBodyAngleX", this.gaze.x * 5 + Math.sin(this.time * 0.7) * 1.5 * idleAmount);
      set("ParamBodyAngleY", -this.gaze.y * 3);
      set("ParamBodyAngleZ", Math.sin(this.time * 0.55) * 2.8 * idleAmount + pose.rotation);
      set("ParamEyeLOpen", eyeOpen);
      set("ParamEyeROpen", eyeOpen);
      set("ParamEyeLSmile", pose.smile);
      set("ParamEyeRSmile", pose.smile);
      set("ParamMouthOpenY", mouthOpen);
      set("ParamMouthForm", 0.15 + pose.smile * 0.85);
      set("ParamCheek", pose.cheek);
      set("ParamBreath", 0.5 + Math.sin(this.time * 1.55) * 0.5 * idleAmount);
      set("ParamHairFront", Math.sin(this.time * 1.1) * 0.35 * idleAmount + pose.rotation * 0.03);
      set("ParamHairSide", Math.sin(this.time * 0.95 + 1) * 0.45 * idleAmount);
      set("ParamHairBack", Math.sin(this.time * 0.82 + 2) * 0.55 * idleAmount);
      set("ParamHairFrontFuwa", Math.sin(this.time * 1.18) * 0.42 * idleAmount + pose.bodyBoost * 0.24);
      set("ParamHairBackFuwa", Math.sin(this.time * 0.92 + 1.4) * 0.5 * idleAmount + pose.bodyBoost * 0.28);
      set("ParamShoulder", Math.sin(this.time * 1.55) * 0.25 * idleAmount + pose.bodyBoost * 0.4);
      set("ParamLeg", Math.sin(this.time * 0.72) * 0.2 * idleAmount + pose.bodyBoost * 0.35);
      set("ParamArmRA", pose.armR);
      set("ParamArmLB", pose.armL);
      set("ParamShoulderRRotation", pose.armR);
      set("ParamElbowRRotation", pose.armR * 0.72);
      set("ParamWristRRotation", pose.armR * 0.9);
      set("ParamShoulderLRotation", pose.armL);
      set("ParamElbowLRotation", pose.armL * 0.72);
      set("ParamWristLRotation", pose.armL * 0.9);
      set("ParamSkirtSway", Math.sin(this.time * 0.75) * 0.34 * idleAmount + pose.rotation * 0.08);
      set("ParamSkirtFlap", Math.sin(this.time * 1.35 + 0.6) * 0.22 * idleAmount + pose.bodyBoost * 0.38);
      set("ParamBustY", Math.sin(this.time * 1.55) * 0.35 * idleAmount + pose.bodyBoost * 0.2);
    }

    getCurrentParameterPose() {
      if (!this.action) {
        return { eye: 1, mouth: 0, smile: 0, cheek: 0, armR: 0, armL: 0, bodyBoost: 0, rotation: 0 };
      }
      const p = clamp(this.action.elapsed / this.action.duration, 0, 1);
      const wave = Math.sin(p * Math.PI);
      const pulse = Math.sin(p * Math.PI * 4);
      const values = { eye: 1, mouth: 0, smile: 0, cheek: 0, armR: 0, armL: 0, bodyBoost: 0, rotation: 0 };
      if (this.action.name === "pet") Object.assign(values, { smile: wave, cheek: wave * 0.8 });
      if (this.action.name === "feed") Object.assign(values, { mouth: Math.max(0, pulse) * 0.9, smile: wave * 0.55, cheek: wave * 0.45 });
      if (this.action.name === "play") Object.assign(values, { bodyBoost: wave, rotation: Math.sin(p * Math.PI * 2) * 5 });
      if (this.action.name === "dance") Object.assign(values, { armR: Math.sin(p * Math.PI * 5) * 22, armL: -Math.sin(p * Math.PI * 5) * 17, smile: 0.8, bodyBoost: 1, rotation: Math.sin(p * Math.PI * 5) * 7 });
      if (this.action.name === "sleep") Object.assign(values, { eye: Math.max(0.08, 1 - wave * 1.25), mouth: Math.max(0, Math.sin(p * Math.PI * 3)) * 0.18 });
      if (this.action.name === "wave") Object.assign(values, { armR: Math.sin(p * Math.PI * 7) * 28, smile: wave, rotation: -wave * 2.5 });
      return values;
    }

    getBlink() {
      if (this.blinkTime > 0.18) return 1;
      const p = clamp(this.blinkTime / 0.18, 0, 1);
      return p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
    }

    getSpeechMouth() {
      if (this.time >= this.speechUntil) return 0;
      const elapsed = this.time - this.speechStartedAt;
      const remaining = this.speechUntil - this.time;
      const fadeIn = clamp(elapsed / 0.12, 0, 1);
      const fadeOut = clamp(remaining / 0.16, 0, 1);
      const syllables =
        Math.sin(elapsed * 17.5) * 0.32
        + Math.sin(elapsed * 28.7 + 0.8) * 0.2
        + Math.sin(elapsed * 9.3 + 1.7) * 0.12;
      return clamp((0.38 + syllables) * fadeIn * fadeOut, 0.04, 0.82);
    }

    speak(duration = 2.4) {
      if (!this.ready) return;
      const safeDuration = clamp(Number(duration) || 2.4, 0.4, 8);
      this.speechStartedAt = this.time;
      this.speechUntil = this.time + safeDuration;
    }

    trackPointer(clientX, clientY) {
      const rect = this.canvasHost.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.gazeTarget.x = clamp(((clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      this.gazeTarget.y = clamp(((clientY - rect.top) / rect.height - 0.44) * 2, -1, 1);
    }

    resetGaze() {
      this.gazeTarget.x = 0;
      this.gazeTarget.y = 0;
    }

    setMotion(enabled) {
      this.enabled = enabled;
      if (!enabled && this.model) {
        this.gazeTarget = { x: 0, y: 0 };
        this.model.position.set(this.baseX, this.baseY);
        this.model.rotation = 0;
      }
    }

    play(name, done) {
      if (!this.ready) {
        done?.();
        return false;
      }
      const durations = { pet: 1.05, feed: 1.25, play: 1.15, dance: 2.1, sleep: 2.4, wave: 1.55 };
      this.action = { name, elapsed: 0, duration: durations[name] || 1.2, done };
      this.host.dataset.action = name;
      return true;
    }

    destroy() {
      this.resizeObserver?.disconnect();
      this.app?.ticker.remove(this.tick);
      this.model?.internalModel?.off("beforeModelUpdate", this.applyParameters);
      this.app?.destroy(true, { children: true, texture: true, baseTexture: true });
      this.ready = false;
    }
  }

  window.HutaoRig = HutaoRig;
})();
