// src/i18n/en.ts — English (source of truth)

import type { Translations } from "./types";

export const en: Translations = {
  "rotate.heading": "Rotate your device",
  "rotate.subtext": "Angle Explorer plays best in landscape mode",

  "toolbar.restart": "Reset",
  "toolbar.mute": "Mute",
  "toolbar.share": "Share",
  "toolbar.comments": "Comments",
  "toolbar.addComment": "Add Comment",

  "social.shareHeading": "Spread the word...",

  "game.enterNumber": "Enter a number!",
  "game.tryAgain": "Try again!",
  "game.dragToAim": "Rotate the blue ray to aim",
  "game.typeToAim": "Type the angle on the keypad to aim",
  "game.tryOnYourOwn": "Try on your own",

  "level1.promptNormal": "Rotate the blue ray to aim, then fire.",
  "level1.promptPlatinum": "Enter the angle to aim, then fire.",
  "level1.angleZero": "ZERO",
  "level1.angleRight": "RIGHT ANGLE",
  "level1.angleStraight": "STRAIGHT",
  "level1.angleReflex": "REFLEX",
  "level1.angleAcute": "ACUTE",
  "level1.angleObtuse": "OBTUSE",

  "level2.promptNormal": "Find the missing angle and fire.",
  "level2.promptPlatinum": "Type in the missing angle and fire.",
  "level2.promptBlindShot": "Type in the missing angle and fire.",
  "level2.complementaryLabel": "COMPLEMENTARY",
  "level2.complementarySub": "SUM = 90\u00b0",
  "level2.supplementaryLabel": "SUPPLEMENTARY",
  "level2.supplementarySub": "SUM = 180\u00b0",
  "level2.completeLabel": "COMPLETE",
  "level2.completeSub": "SUM = 360\u00b0",

  "monster.instruction": "Enter the angle to aim, then fire.",
  "monster.destroyTargets": "Destroy {count} targets \uD83C\uDFAF",
  "monster.victorySubtitle": "\uD83D\uDCA5 Barrage Survived! \uD83D\uDCA5",

  "platinum.instruction": "Type the angle, then press Fire.",
  "platinum.destroyTargets": "Destroy {count} targets \uD83C\uDFAF",
  "platinum.victorySubtitle": "\uD83C\uDFAF Platinum Cleared! \uD83C\uDFAF",

  "report.shareReport": "Share Report",
  "report.creating": "Creating...",
  "report.nextLevel": "Next Level",
  "report.playAgain": "Play Again",
  "report.levelComplete": "Level {level} Complete!",
  "report.monsterCrushed": "Monster Round Crushed!",
  "report.platinumCrushed": "Platinum Round Crushed!",
  "report.score": "Score",
  "report.accuracy": "Accuracy",
  "report.stars": "Stars",
  "report.sendSuccess": "Report sent to {email}",
  "report.sendFail": "Failed to send report.",

  "completion.allLevelsTitle": "You Did It!",
  "completion.allLevelsSub": "All {count} Levels Cleared. You now know your angles!",

  "autopilot.clickToStop": "Click to stop autopilot",
  "autopilot.ariaCancel": "Autopilot active \u2014 click to cancel",

  "lang.label": "Language",
  "lang.en": "English",
  "lang.zh": "\u4e2d\u6587",
  "lang.es": "Espa\u00f1ol",
  "lang.ru": "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
  "lang.hi": "\u0939\u093f\u0928\u094d\u0926\u0940",
  "lang.other": "Other...",
  "lang.translating": "Translating...",
  "lang.translateFail": "Translation failed. Please try again.",
  "lang.promptTitle": "Translate to another language",
  "lang.promptPlaceholder": "e.g. French, Arabic, Hindi...",
  "lang.translate": "Translate",
  "lang.cancel": "Cancel",
};
