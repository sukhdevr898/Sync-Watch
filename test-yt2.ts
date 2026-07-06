import ytSearch from "yt-search";
async function test() {
  const searchResult = await ytSearch("test");
  console.log(searchResult.videos[0].url);
}
test();
