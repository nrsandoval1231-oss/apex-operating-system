import { takeoff } from './engine.mjs';

let refused = false;
try {
  takeoff({ length: 24, width: 14 });
} catch (error) {
  refused = /approved Designer takeoff revision/i.test(String(error?.message));
}

if (!refused) {
  throw new Error('Production takeoff must refuse every pricing request without an approved Designer revision.');
}

console.log('1 pass / 0 fail');
