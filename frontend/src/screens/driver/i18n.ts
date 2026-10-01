import type { Language } from "./types";

/**
 * The driver's string dictionary (field conventions section 5, driver prompt 3 section 3). Every
 * driver string routes through `t(key, params)` now; English is complete, Sinhala and Tamil are
 * filled in driver prompt 5 and fall back to English until then. Language labels on R1.9 are
 * always shown in their own script, so they are not dictionary entries.
 */

export type Dict = Record<string, string>;

const en: Dict = {
  "tab.run": "Run",
  "tab.issues": "Issues",
  "tab.history": "History",
  "tab.me": "Me",

  "connectivity.online": "Online",
  "connectivity.synced": "Synced",
  "connectivity.offline": "Offline",
  "connectivity.syncing": "Syncing",
  "connectivity.failed": "Failed",

  "banner.offlineSaved": "Offline · {count} saved on phone",
  "banner.offlineLastSync": "Last sync {time}",
  "banner.offlineWaiting": "Offline · last sync {time} · {count} waiting",
  "banner.offlineNothingToSend": "Nothing to send",
  "banner.routeSaved": "Offline · route saved",

  "run.title": "Run {runNo} · {vehicleId}",
  "run.noRoute": "No route yet",
  "run.noRouteBody": "You don't need to do anything. Your route appears here and downloads to this phone as soon as Dispatch publishes it.",
  "run.releaseFact": "Plan release",
  "run.vehicleFact": "Vehicle",
  "run.downloading": "Downloading your route for offline use…",
  "run.readyOffline": "Ready offline",
  "run.planUnchanged": "Plan v{version} - route unchanged since v3.",
  "run.planOnPhone": "Plan v{version} is on this phone",
  "run.waitingForLoading": "Waiting for loading - {depot} dock hasn't cleared {vehicleId} yet.",
  "run.confirmedBy": "Confirmed by {name} · {time}",
  "run.ordersOnBoard": "{count} orders on board",
  "run.readyOfflineTag": "Plan v{version} · ready offline",
  "run.stopsCount": "{count} stops",
  "run.stopsDone": "{done} of {total} stops done",
  "run.allSynced": "All synced",
  "run.departed": "Departed",
  "run.departedLine": "Departed {time} · next: {outletName}, arrive about {eta}",
  "run.stopOf": "Stop {number} of {total} · {district}",
  "run.allRecorded": "All stops recorded",
  "run.allRecordedBody": "Both stops are saved on this phone and in your trip history. They send when you have signal.",
  "run.inTripHistory": "In trip history",
  "run.finishHelper": "Finish when you're back at the depot. Distance is tracked by GPS, even without signal.",
  "run.savedToast": "Delivery saved on this phone. Sends when you're back online.",
  "run.downloadFailedTitle": "Route didn't download",
  "run.downloadFailedBody": "Connect before you leave the depot - the route must be on this phone.",
  "run.downloadedCount": "Downloaded",
  "run.callDispatch": "Call Dispatch",
  "run.dispatchDesk": "Peliyagoda dispatch desk",
  "run.startRouteLocked": "Locked until your route is on this phone.",
  "run.startRouteHelper": "This records your departure and starts tracking distance. Works offline.",
  "run.willWait": "Will wait {minutes} min",

  "action.acknowledgeV": "Acknowledge v{version}",
  "action.acknowledgePlanV": "Acknowledge plan v{version}",
  "action.startRoute": "Start route",
  "action.arrive": "Arrive",
  "action.navigate": "Navigate",
  "action.problem": "Problem",
  "action.tryAgain": "Try again",
  "action.finishRun": "Finish run",
  "action.backToRun": "Back to run",
  "action.retry": "Retry",
  "action.recordArrival": "Record arrival",
  "action.recordOutcome": "Record outcome",

  "stop.title": "Stop {number} · {outletId}",
  "stop.ofTotal": "Stop {number} of {total}",
  "stop.window": "Window",
  "stop.plannedArrival": "Planned arrival",
  "stop.unloading": "Unloading",
  "stop.unloadingNote": "{dock}, {parking}. Allow about {minutes} min to unload.",
  "stop.ordersOnStop": "Orders on this stop",
  "stop.arrival": "Arrival {time}",
  "stop.savedOnPhone": "Saved on phone",
  "stop.arrivalSavedWillSync": "Arrival saved on this phone - it will sync.",
  "stop.couldNotSaveArrival": "Couldn't save arrival. Tap again.",
  "stop.waitingFor": "Arrived {time} · Waiting",
  "stop.windowOpensAt": "Window opens {time}",
  "stop.toGo": "{minutes} min to go",
  "stop.opensAt": "Opens at {time}",
  "stop.windowOpenTitle": "Window open · {outletId}",
  "stop.windowOpenBody": "Hand over the goods, then record the outcome.",
  "stop.windowOpened": "Window opened",
  "stop.waited": "Waited {minutes} min",
  "stop.insideWindow": "Inside window",
  "stop.notOnRoute": "This stop isn't on your route.",
  "stop.notOnRouteBody": "Your run lists every stop you have for Run {runNo}.",
  "stop.opening": "Opening stop…",
  "stop.shortfall": "Loader reported {short} short - deliver {deliver} of {expected}.",
  "stop.unitsExpected": "{count} units expected",
  "stop.short": "{count} short",
  "stop.deliver": "Deliver {count}",

  "outcome.title": "Deliver · Stop {number}",
  "outcome.sameOutcome": "Same outcome for both orders",
  "outcome.outcome": "Outcome",
  "outcome.delivered": "Delivered",
  "outcome.damaged": "Damaged",
  "outcome.refused": "Refused",
  "outcome.storeClosed": "Store closed",
  "outcome.other": "Other",
  "outcome.unitsDelivered": "Units delivered",
  "outcome.of": "{value} of {expected}",
  "outcome.proof": "Proof of delivery",
  "outcome.photoTaken": "Photo taken",
  "outcome.retakePhoto": "Retake photo",
  "outcome.takePhoto": "Take photo",
  "outcome.receivedBy": "Received by",
  "outcome.deviceTime": "Device time {time}",
  "outcome.addSignature": "Add signature (optional)",
  "outcome.save": "Save delivery record",
  "outcome.saveStoreClosed": "Save store closed record",
  "outcome.saveRefused": "Save refused record",
  "outcome.savesOffline": "This record saves to your phone now and syncs automatically. Nothing is lost.",
  "outcome.damagedHelper": "{count} units damaged. Deliver the rest and take a photo of the damage.",
  "outcome.closedPhotoRequired": "Photo of the closed shopfront · required",
  "outcome.closedPhotoHelper": "Show the shutter or door and the store sign.",
  "outcome.closedNoReceiver": "Receiver name isn't needed when the store is closed.",
  "outcome.whatHappensNext": "What happens next",
  "outcome.dispatchWillDecide": "Dispatch will decide what happens next.",
  "outcome.refusedReason": "Why was it refused?",
  "outcome.refusedBy": "Refused by",
  "outcome.validationMissing": "Add a photo and the receiver's name to save.",
  "outcome.savedTitle": "Delivery saved on this phone. Sends when you're back online.",
  "outcome.nextStop": "Next stop: {outletId}",
  "outcome.movedToHistory": "{outletId} moved to trip history",
  "outcome.issueSent": "{outcome} · issue sent to Dispatch when you reconnect",

  "camera.title": "Photo of goods at the store door",
  "camera.subtitle": "{outletId} · proof of delivery",
  "camera.helper": "Show the goods at the store door",
  "camera.deviceTimeStamped": "Device time is stamped on the photo.",
  "camera.retake": "Retake",
  "camera.usePhoto": "Use photo",

  "receiver.recentNames": "Recent names at {outletId}",
  "receiver.save": "Save name",

  "signature.title": "Signature",
  "signature.ask": "Ask the receiver to sign",
  "signature.helper": "Optional. Use a finger inside the box. The name and photo are enough on their own.",
  "signature.clear": "Clear",
  "signature.save": "Save signature",

  "me.title": "Me",
  "me.sunlight": "Screen for bright sunlight",
  "me.sunlightHelper": "High contrast, no shadows",
  "me.themeFollows": "Dark mode follows your phone's setting.",
  "me.textSize": "Text size",
  "me.standard": "Standard",
  "me.large": "Large",
  "me.language": "Language",
  "me.distanceTracking": "Distance tracking",
  "me.alwaysOn": "Always on",
  "me.gpsNote": "GPS, always on during a run. Works offline.",
  "me.offlineStorage": "Offline storage",
  "me.storageUsed": "{size} used",
};

const dictionaries: Record<Language, Dict> = { en, si: {}, ta: {} };

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/** Looks up `key` in `language`'s dictionary, falling back to English, then the key itself. */
export function translate(language: Language, key: string, params?: Record<string, string | number>): string {
  const template = dictionaries[language]?.[key] ?? en[key] ?? key;
  return format(template, params);
}
