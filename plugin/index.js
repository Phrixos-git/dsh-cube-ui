/**
 * Host half of the Cube UI bundle.
 *
 * Everything the cube needs lives in the browser half: it replaces the
 * conversation panel with the cube stage, embeds the standard conversation
 * content and composer inside that stage, and draws the diamond navigation and
 * the dock through overlay slots. This host row only makes the package
 * discoverable to the client module graph, so it declares no services and
 * performs no work.
 */

/** No host-side services are needed. */
export function apply() {}
