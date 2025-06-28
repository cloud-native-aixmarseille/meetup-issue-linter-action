import { AbstractZodLinterAdapter } from "./abtract-zod-linter.adapter";

export type EntityWithUrl = {
  name: string;
  url: string;
};

/**
 * Abstract adapter for linting fields that contain entities with URLs.
 * Provides common functionality for extracting names from markdown links,
 * validating entities against a known list, and formatting entities with links.
 */
export abstract class AbstractEntityLinkLinterAdapter extends AbstractZodLinterAdapter {
  private static LINK_REGEX = /\[([^\]]+)\]\([^)]+\)/g;

  protected readonly nameToUrl: Map<string, string>;

  constructor(entities: EntityWithUrl[]) {
    super();
    this.nameToUrl = new Map(entities.map((entity) => [entity.name, entity.url]));
  }

  /**
   * Extracts entity names from text that may contain markdown links.
   * @param text Text that may contain entities with or without markdown links
   * @returns Array of entity names
   */
  protected extractEntityNames(text: string): string[] {
    // Replace linked entities with their display text
    const cleanedText = text.replace(AbstractEntityLinkLinterAdapter.LINK_REGEX, "$1");
    return cleanedText.split(",").map((name) => name.trim());
  }

  /**
   * Checks if the given text contains a markdown link.
   * @param text Text to check
   * @returns True if text contains a markdown link
   */
  protected hasLink(text: string): boolean {
    return AbstractEntityLinkLinterAdapter.LINK_REGEX.test(text);
  }

  /**
   * Extracts a single entity name from text that may contain a markdown link.
   * @param text Text that may contain an entity with or without markdown link
   * @returns Entity name
   */
  protected extractEntityName(text: string): string {
    return text.replace(AbstractEntityLinkLinterAdapter.LINK_REGEX, "$1");
  }

  /**
   * Formats an entity name with its URL as a markdown link.
   * @param entityName Name of the entity
   * @returns Formatted markdown link or plain name if no URL found
   */
  protected formatEntityWithLink(entityName: string): string {
    const url = this.nameToUrl.get(entityName);
    return url ? `[${entityName}](${url})` : entityName;
  }

  /**
   * Validates that an entity name exists in the known list.
   * @param entityName Name to validate
   * @returns True if entity exists
   */
  protected isValidEntity(entityName: string): boolean {
    return this.nameToUrl.has(entityName);
  }

  /**
   * Gets all valid entity names.
   * @returns Array of valid entity names
   */
  protected getValidEntityNames(): string[] {
    return Array.from(this.nameToUrl.keys());
  }
}
