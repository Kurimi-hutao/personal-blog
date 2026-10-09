(() => {
  "use strict";

  const voice = (text, audio) => Object.freeze({ text, audio });
  const path = (role, name) => `./assets/audio/${role}/${role}-${name}.mp3`;

  window.PET_VOICE_LIBRARY = Object.freeze({
    hutao: Object.freeze({
      welcome: voice("这次真的醒过来啦！移动光标看看？", path("hutao", "welcome-01")),
      actions: Object.freeze({
        pet: Object.freeze([
          voice("嘿嘿，再摸一下也不是不行。", path("hutao", "pet-01")),
          voice("帽子可不能揉乱啦。", path("hutao", "pet-02")),
        ]),
        feed: Object.freeze([
          voice("唔，这个味道不错！", path("hutao", "feed-01")),
          voice("吃饱才有力气工作嘛。", path("hutao", "feed-02")),
        ]),
        play: Object.freeze([
          voice("抓到你啦！再来一次！", path("hutao", "play-01")),
          voice("今天的胜负可还没定呢。", path("hutao", "play-02")),
        ]),
        dance: Object.freeze([
          voice("一二三，跟上本堂主的节拍！", path("hutao", "dance-01")),
          voice("这支舞就当今日特别演出。", path("hutao", "dance-02")),
        ]),
        sleep: Object.freeze([
          voice("只眯一小会儿……呼……", path("hutao", "sleep-01")),
          voice("午后的阳光最适合打盹。", path("hutao", "sleep-02")),
        ]),
        wave: Object.freeze([
          voice("我一直都看见你哦。", path("hutao", "wave-01")),
          voice("嗨！今天也要开心。", path("hutao", "wave-02")),
        ]),
      }),
      system: Object.freeze({
        gift: voice("今日份的桃花币，收好啦！", path("hutao", "gift-01")),
        coinsEmpty: voice("桃花币不够啦，先领取今日小礼吧。", path("hutao", "coins-empty-01")),
        motionOn: voice("好啦，我继续活动活动。", path("hutao", "motion-on-01")),
        motionOff: voice("那我先安静地待一会儿。", path("hutao", "motion-off-01")),
        reset: voice("又回到最舒服的位置啦。", path("hutao", "reset-01")),
      }),
    }),
    fireman: Object.freeze({
      welcome: voice("听说这里有好酒好茶，我便来串个门。", path("fireman", "welcome-01")),
      actions: Object.freeze({
        pet: Object.freeze([
          voice("哈哈，胆子不小。", path("fireman", "pet-01")),
          voice("这份热情，我记下了。", path("fireman", "pet-02")),
        ]),
        feed: Object.freeze([
          voice("不错，再来一碗。", path("fireman", "feed-01")),
          voice("有酒有肉，才叫痛快。", path("fireman", "feed-02")),
        ]),
        play: Object.freeze([
          voice("来，痛痛快快比一场！", path("fireman", "play-01")),
          voice("这点热身还不够尽兴。", path("fireman", "play-02")),
        ]),
        dance: Object.freeze([
          voice("烈火随心，步子自然也要豪迈。", path("fireman", "dance-01")),
          voice("今日兴起，便舞上一回。", path("fireman", "dance-02")),
        ]),
        sleep: Object.freeze([
          voice("养足精神，再战不迟。", path("fireman", "sleep-01")),
          voice("我先歇片刻，酒可别收走。", path("fireman", "sleep-02")),
        ]),
        wave: Object.freeze([
          voice("季沧海，前来拜访。", path("fireman", "wave-01")),
          voice("有朋在此，岂能不来？", path("fireman", "wave-02")),
        ]),
      }),
    }),
    zhang: Object.freeze({
      welcome: voice("我来了。这里，很安静。", path("zhang", "welcome-01")),
      actions: Object.freeze({
        pet: Object.freeze([
          voice("……别闹。", path("zhang", "pet-01")),
          voice("嗯。", path("zhang", "pet-02")),
        ]),
        feed: Object.freeze([
          voice("谢谢。", path("zhang", "feed-01")),
          voice("够了。", path("zhang", "feed-02")),
        ]),
        play: Object.freeze([
          voice("跟上。", path("zhang", "play-01")),
          voice("动作要快。", path("zhang", "play-02")),
        ]),
        dance: Object.freeze([
          voice("不太擅长。", path("zhang", "dance-01")),
          voice("只一次。", path("zhang", "dance-02")),
        ]),
        sleep: Object.freeze([
          voice("我守着。", path("zhang", "sleep-01")),
          voice("休息吧。", path("zhang", "sleep-02")),
        ]),
        wave: Object.freeze([
          voice("张起灵。", path("zhang", "wave-01")),
          voice("我在。", path("zhang", "wave-02")),
        ]),
      }),
    }),
  });
})();
