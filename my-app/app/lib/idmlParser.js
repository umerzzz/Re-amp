// Import from modularized code
import { IDMLParser as ModularIDMLParser } from "./idml/index";

export class IDMLParser extends ModularIDMLParser {
  // This class extends the modularized version to maintain the same API for backwards compatibility
  constructor(idmlJson) {
    super(idmlJson);
  }
}
