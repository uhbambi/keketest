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
const RecursiveMdParagraph = ({ pArray }) => pArray.map((part) => {
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

const MdParagraph = ({
  text, attachmentInfo = [], className, scrollRef,
}) => {
  /*
   * [[desc, href], ...]
   */
  const [shownEmbeds, setShownEmbeds] = useState([]);

  const contextData = useMemo(() => ({
    isEmbedOpen: (href) => shownEmbeds.some(
      (embedOpts) => embedOpts[1] === href,
    ),
    openEmbed: (embedOpts) => {
      if (scrollRef?.current) {
        requestAnimationFrame(() => {
          scrollRef?.current?.();
        });
      }
      return setShownEmbeds((cs) => [...cs, embedOpts]);
    },
    closeEmbed: (href) => setShownEmbeds(
      (cs) => cs.filter((embedOpts) => embedOpts[1] !== href),
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [shownEmbeds]);

  const [pArray, pAttachments] = useMemo(() => parseParagraph(text), [text]);
  const Attachment = EMBEDS['/'][0];
  console.log('MARKDOWN', pArray, pAttachments, attachmentInfo);

  return (
    <EmbedContext.Provider value={contextData}>
      <div className={className}>
        <RecursiveMdParagraph pArray={pArray} />
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '3px',
        }}
        >
          {shownEmbeds.map(([desc, href]) => {
            const Embed = EMBEDS[desc][0];
            return (
              <Embed
                key={href}
                url={href}
                maxHeight={300}
                scrollRef={scrollRef}
              />
            );
          })}
          {pAttachments.map(([title, mediaId]) => {
            let width;
            let height;
            let avgColor;
            let type;
            const fileInfo = attachmentInfo.find(([id]) => id === mediaId);
            if (fileInfo) {
              console.log('FOUND FILEINFO', fileInfo);
              [, type, , width, height, avgColor] = fileInfo;
            }
            return (
              <Attachment
                key={mediaId}
                mediaId={mediaId}
                title={title}
                width={width}
                height={height}
                avgColor={avgColor}
                type={type}
                scrollRef={scrollRef}
              />
            );
          })}
        </div>
      </div>
    </EmbedContext.Provider>
  );
};

export default React.memo(MdParagraph);
