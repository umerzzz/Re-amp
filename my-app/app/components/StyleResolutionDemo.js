import { IDMLParser } from "../lib/idmlParser";

export default function StyleResolutionDemo({ idmlJsonData }) {
  // Create an instance of the IDMLParser with the IDML JSON data
  const parser = new IDMLParser(idmlJsonData);

  // Get all character styles defined in the document
  const characterStyles = parser.getCharacterStyles();
  console.log("Character Styles:", characterStyles);

  // Get all paragraph styles defined in the document
  const paragraphStyles = parser.getParagraphStyles();
  console.log("Paragraph Styles:", paragraphStyles);

  // Resolve a specific character style by reference
  const titleStyle = parser.resolveCharacterStyle("CharacterStyle/title");
  console.log("Title Style:", titleStyle);

  // Enhance content with resolved style information
  const enhancedData = parser.enrichContentWithStyles();

  // Now you can use the enhanced data with resolved styles
  // This allows you to access style information directly from content elements

  // Example: Accessing style information for a text element
  function renderTextWithStyle(contentElement) {
    if (contentElement.Content && contentElement._resolvedCharacterStyle) {
      // Apply style properties from the resolved style
      const style = contentElement._resolvedCharacterStyle;
      return (
        <span
          style={{
            fontSize: `${style.pointSize}px`,
            // Add other style properties as needed
          }}
        >
          {contentElement.Content}
        </span>
      );
    }

    // Fallback for elements without resolved style
    return <span>{contentElement.Content}</span>;
  }

  return (
    <div>
      <h1>IDML Style Resolution</h1>

      <h2>Character Styles</h2>
      <ul>
        {Object.keys(characterStyles).map((styleRef) => {
          const style = characterStyles[styleRef];
          return (
            <li key={styleRef}>
              <strong>{style["@_Name"]}</strong>
              {style["@_PointSize"] && (
                <span> - Size: {style["@_PointSize"]}</span>
              )}
            </li>
          );
        })}
      </ul>

      <h2>Paragraph Styles</h2>
      <ul>
        {Object.keys(paragraphStyles).map((styleRef) => {
          const style = paragraphStyles[styleRef];
          return (
            <li key={styleRef}>
              <strong>{style["@_Name"]}</strong>
              {style["@_Justification"] && (
                <span> - Alignment: {style["@_Justification"]}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
