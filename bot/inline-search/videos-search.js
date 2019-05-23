const debug = require('debug')('main:bot:inline-search:videos');
const { sendNothingFound } = require('./common');
const htmlEntities = require('he');
const youtube = require('googleapis').google.youtube('v3');

const apiKey = process.env.GOOGLE_API_KEY;
const cacheTime = 86400; // one day

module.exports = async function videosSearch(query, ctx) {
  if (!query) {
    debug('Empty query');
    return ctx.answerInlineQuery([], { cache_time: cacheTime });
  }

  const pageToken = ctx.inlineQuery.offset || undefined;

  const { results, nextPageToken } = await _searchYoutube(query, pageToken);

  if (results.length === 0) {
    debug('Nothing found for %s', query);
    return await sendNothingFound(ctx, cacheTime);
  }

  debug('Sending answer for %s', query);
  return await ctx.answerInlineQuery(results, {
    next_offset: nextPageToken || undefined,
    cache_time: cacheTime,
  });
};

async function _searchYoutube(query, pageToken) {
  debug('Requesting YouTube %s', query);
  const { data } = await youtube.search.list({
    part: 'snippet',
    q: query,
    maxResults: 20,
    type: 'video',
    videoEmbeddable: true,
    key: apiKey,
    pageToken: pageToken || undefined,
    fields:
      'items(id/videoId,snippet(channelTitle,thumbnails/default/url,title)),nextPageToken',
  });
  debug('Result received from YouTube for %s', query);

  return {
    nextPageToken: data.nextPageToken,
    results: _formatYouTubeSearchItems(data.items),
  };
}

function _formatYouTubeSearchItems(items) {
  return items.map((item, i) => {
    return {
      type: 'video',
      id: i,
      video_url: 'https://www.youtube.com/embed/' + item.id.videoId,
      mime_type: 'text/html',
      thumb_url: item.snippet.thumbnails.default.url,
      title: item.snippet.title,
      description: item.snippet.channelTitle,
      input_message_content: {
        message_text:
          '<b>🎞️ ' +
          htmlEntities.encode(item.snippet.title || '', {
            useNamedReferences: false,
          }) +
          '</b>\n' +
          htmlEntities.encode(
            'http://www.youtube.com/watch?v=' + (item.id.videoId || ''),
            {
              useNamedReferences: false,
            },
          ),
        parse_mode: 'HTML',
      },
    };
  });
}
