/**
 * Point Prettier at the shared configuration.
 *
 * `packages/config/prettier.config.js` has always held the frontend's real style:
 * single quotes, a 100 column width, trailing commas. Nothing at the root ever
 * pointed Prettier at it, so `prettier --check` ran with the defaults instead and
 * disagreed with all 225 files, which is why it has always failed and been ignored.
 *
 * Running `--write` under those defaults would not have fixed anything either: it
 * would have rewritten the whole codebase from single to double quotes, against a
 * style the code follows uniformly in 933 places and contradicts in none.
 *
 * The file is .mjs because the root package is CommonJS and the shared config is
 * an ES module.
 */
export { default } from './packages/config/prettier.config.js';
