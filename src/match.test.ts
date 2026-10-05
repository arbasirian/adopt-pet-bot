import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWantedBreed } from './match.ts';

test('matches wanted breeds, crosses and spelling variants', () => {
  for (const race of [
    'Golden Retriever',
    'golden retriever',
    'Golden Retriever Mix',
    'Labrrador/ golden retriever',
    'mechelse herder/golden retriever',
    'Berner Sennen',
    'Berner Sennen Hond',
    'Bernersennen',
    'Mechelaar x bernersenner',
    'Bernese Mountain Dog',
    'BERNESE MOUNTAIN DOG cross',
  ]) {
    assert.equal(isWantedBreed(race), true, race);
  }
});

test('does not match other breeds or generic "golden"', () => {
  for (const race of [
    'Goldendoodle',
    'Golden doodle',
    'Kruising Labradoodle & Goldendoodle',
    'Entlebucher Sennenhond',
    'Zwitserse sennen x Australian Shepherd X Labrador',
    'Labrador',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isWantedBreed(race), false, String(race));
  }
});
