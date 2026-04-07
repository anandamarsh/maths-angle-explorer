// src/i18n/types.ts

export type TranslationKey =
  // Rotate prompt
  | "rotate.heading"
  | "rotate.subtext"
  // Toolbar
  | "toolbar.restart"
  | "toolbar.mute"
  | "toolbar.share"
  | "toolbar.comments"
  | "toolbar.addComment"
  // Social
  | "social.shareHeading"
  // Game feedback
  | "game.enterNumber"
  | "game.tryAgain"
  | "game.dragToAim"
  | "game.typeToAim"
  | "game.tryOnYourOwn"
  // Level 1
  | "level1.promptNormal"
  | "level1.promptPlatinum"
  | "level1.angleZero"
  | "level1.angleRight"
  | "level1.angleStraight"
  | "level1.angleReflex"
  | "level1.angleAcute"
  | "level1.angleObtuse"
  // Level 2
  | "level2.promptNormal"
  | "level2.promptPlatinum"
  | "level2.promptBlindShot"
  | "level2.complementaryLabel"
  | "level2.complementarySub"
  | "level2.supplementaryLabel"
  | "level2.supplementarySub"
  | "level2.completeLabel"
  | "level2.completeSub"
  // Monster round
  | "monster.instruction"
  | "monster.destroyTargets"
  | "monster.victorySubtitle"
  // Platinum round
  | "platinum.instruction"
  | "platinum.destroyTargets"
  | "platinum.victorySubtitle"
  // Session report modal
  | "report.shareReport"
  | "report.creating"
  | "report.nextLevel"
  | "report.playAgain"
  | "report.levelComplete"
  | "report.monsterCrushed"
  | "report.platinumCrushed"
  | "report.score"
  | "report.accuracy"
  | "report.stars"
  | "report.sendSuccess"
  | "report.sendFail"
  // Level completion
  | "completion.allLevelsTitle"
  | "completion.allLevelsSub"
  // Autopilot
  | "autopilot.clickToStop"
  | "autopilot.ariaCancel"
  // Language switcher
  | "lang.label"
  | "lang.en"
  | "lang.zh"
  | "lang.es"
  | "lang.ru"
  | "lang.hi"
  | "lang.other"
  | "lang.translating"
  | "lang.translateFail"
  | "lang.promptTitle"
  | "lang.promptPlaceholder"
  | "lang.translate"
  | "lang.cancel";

export type Translations = Record<TranslationKey, string>;

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;
