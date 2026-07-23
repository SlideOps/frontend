// Root ESLint flat config for the SlideOps frontend.
// Every app and package inherits the shared config, so linting stays consistent.
// ESLint searches ancestor directories, so running eslint from any package
// resolves to this file.
import shared from './packages/config/eslint.config.js';

export default shared;
