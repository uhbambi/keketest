/*
 * Renders Markdown that got parsed by core/MarkdownParser
 */
import React, { useState, useMemo } from 'react';

import MdLink from './MdLink.jsx';
import MdMention from './MdMention.jsx';
import EMBEDS from '../embeds/index.js';
import EmbedContext from '../context/embed.js';
import { parseParagraph } from '../../utils/markdown/MarkdownParser.js';

/**
 * parse a markdown paragraph,
 * either text or pArray should be given, not both
 * @param {
 *   text: markdown text
 *   pArray: parsed markdown array
 * }
 */
const RecursiveMdParagraph = ({ text, pArray }) => {
  if (!pArray) {
    if (!text) {
      return null;
    }
    pArray = parseParagraph(text);
  }

  return pArray.map((part) => {
    if (!Array.isArray(part)) {
      return part;
    }
    const type = part[0];
    switch (type) {
      case 'c':
        return (<code>{part[1]}</code>);
      case '*':
        return (
          <strong>
            <MdParagraph pArray={part[1]} />
          </strong>
        );
      case '~':
        return (
          <s>
            <MdParagraph pArray={part[1]} />
          </s>
        );
      case '+':
        return (
          <em>
            <MdParagraph pArray={part[1]} />
          </em>
        );
      case '_':
        return (
          <u>
            <MdParagraph pArray={part[1]} />
          </u>
        );
      case 'img':
      case 'l':
        return (
          <MdLink href={part[2]} title={part[1]} />
        );
      case '@':
        return (
          <MdMention uid={part[2]} name={part[1]} />
        );
      default:
        return type;
    }
  });
};

const MdParagraph = ({ text, pArray, className }) => {
  /*
   * [[desc, href], ...]
   */
  const [shownEmbeds, setShownEmbeds] = useState([]);

  const contextData = useMemo(() => ({
    isEmbedOpen: (href) => shownEmbeds.some(
      (embedOpts) => embedOpts[1] === href,
    ),
    openEmbed: (embedOpts) => setShownEmbeds((cs) => [...cs, embedOpts]),
    closeEmbed: (href) => setShownEmbeds(
      (cs) => cs.filter((embedOpts) => embedOpts[1] !== href),
    ),
  }), [shownEmbeds]);

  return (
    <EmbedContext.Provider value={contextData}>
      <div className={className}>
        <RecursiveMdParagraph text={text} pArray={pArray} />
        {shownEmbeds.map(([desc, href]) => {
          const Embed = EMBEDS[desc][0];
          return <Embed key={href} url={href} maxHeight={300} />;
        })}
      </div>
    </EmbedContext.Provider>
  );
};

export default React.memo(MdParagraph);
