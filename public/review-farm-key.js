'use strict';
window.FARM_REVIEW_FEED=location.pathname.endsWith('review-feed.html');
window.DALI_CONFIG=Object.freeze({...DALI_CONFIG,storageKey:'dali-os-qa-visual-'+(FARM_REVIEW_FEED?'feed':'farm')});
