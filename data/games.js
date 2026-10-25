// Tracks ordered by serial number. A track's composer is set only where it differs from the game's.
// Scores come from data/scores.csv (see src/model.js).
export const GAMES = [
  {
    id: "mm1", title: "Mega Man", year: 1987, composer: "Manami Matsumae", tracks: [
      { name: "Cut Man", dln: "DLN-003", audio: "audio/cutman.mp3" },
      { name: "Guts Man", dln: "DLN-004", audio: "audio/gutsman.mp3" },
      { name: "Ice Man", dln: "DLN-005", audio: "audio/iceman.mp3" },
      { name: "Bomb Man", dln: "DLN-006", audio: "audio/bombman.mp3" },
      { name: "Fire Man", dln: "DLN-007", audio: "audio/fireman.mp3" },
      { name: "Elec Man", dln: "DLN-008", audio: "audio/elecman.mp3" },
    ]
  },
  {
    id: "mmpu", title: "Mega Man Powered Up", year: 2006, composer: "Toshihiko Horiyama", tracks: [
      { name: "Cut Man", dln: "DLN-003", composer: "arr. Toshihiko Horiyama · orig. Manami Matsumae", audio: "audio/mmpu-cutman.mp3" },
      { name: "Guts Man", dln: "DLN-004", composer: "arr. Toshihiko Horiyama · orig. Manami Matsumae", audio: "audio/mmpu-gutsman.mp3" },
      { name: "Ice Man", dln: "DLN-005", composer: "arr. Toshihiko Horiyama · orig. Manami Matsumae", audio: "audio/mmpu-iceman.mp3" },
      { name: "Bomb Man", dln: "DLN-006", composer: "arr. Toshihiko Horiyama · orig. Manami Matsumae", audio: "audio/mmpu-bombman.mp3" },
      { name: "Fire Man", dln: "DLN-007", composer: "arr. Toshihiko Horiyama · orig. Manami Matsumae", audio: "audio/mmpu-fireman.mp3" },
      { name: "Elec Man", dln: "DLN-008", composer: "arr. Toshihiko Horiyama · orig. Manami Matsumae", audio: "audio/mmpu-elecman.mp3" },
      { name: "Time Man", dln: "DLN-00A", audio: "audio/mmpu-timeman.mp3" },
      { name: "Oil Man", dln: "DLN-00B", audio: "audio/mmpu-oilman.mp3" },
    ]
  },
  {
    id: "mm2", title: "Mega Man 2", year: 1988, composer: "Takashi Tateishi", tracks: [
      { name: "Metal Man", dln: "DWN-009", audio: "audio/metalman.mp3" },
      { name: "Air Man", dln: "DWN-010", audio: "audio/airman.mp3" },
      { name: "Bubble Man", dln: "DWN-011", audio: "audio/bubbleman.mp3" },
      { name: "Quick Man", dln: "DWN-012", audio: "audio/quickman.mp3" },
      { name: "Crash Man", dln: "DWN-013", audio: "audio/crashman.mp3" },
      { name: "Flash Man", dln: "DWN-014", audio: "audio/flashman.mp3" },
      { name: "Heat Man", dln: "DWN-015", audio: "audio/heatman.mp3" },
      { name: "Wood Man", dln: "DWN-016", audio: "audio/woodman.mp3" },
    ]
  },
  {
    id: "mm3", title: "Mega Man 3", year: 1990, composer: "Yasuaki Fujita & Harumi Fujita", tracks: [
      { name: "Needle Man", dln: "DWN-017", audio: "audio/needleman.mp3", composer: "Harumi Fujita" },
      { name: "Magnet Man", dln: "DWN-018", audio: "audio/magnetman.mp3", composer: "Yasuaki Fujita" },
      { name: "Gemini Man", dln: "DWN-019", audio: "audio/geminiman.mp3", composer: "Harumi Fujita" },
      { name: "Hard Man", dln: "DWN-020", audio: "audio/hardman.mp3", composer: "Yasuaki Fujita" },
      { name: "Top Man", dln: "DWN-021", audio: "audio/topman.mp3", composer: "Yasuaki Fujita" },
      { name: "Snake Man", dln: "DWN-022", audio: "audio/snakeman.mp3", composer: "Yasuaki Fujita" },
      { name: "Spark Man", dln: "DWN-023", audio: "audio/sparkman.mp3", composer: "Yasuaki Fujita" },
      { name: "Shadow Man", dln: "DWN-024", audio: "audio/shadowman.mp3", composer: "Yasuaki Fujita" },
    ]
  },
  {
    id: "mm4", title: "Mega Man 4", year: 1991, composer: "Minae Fujii", tracks: [
      { name: "Bright Man", dln: "DCN-025", audio: "audio/brightman.mp3" },
      { name: "Toad Man", dln: "DCN-026", audio: "audio/toadman.mp3" },
      { name: "Drill Man", dln: "DCN-027", audio: "audio/drillman.mp3" },
      { name: "Pharaoh Man", dln: "DCN-028", audio: "audio/pharaohman.mp3" },
      { name: "Ring Man", dln: "DCN-029", audio: "audio/ringman.mp3" },
      { name: "Dust Man", dln: "DCN-030", audio: "audio/dustman.mp3" },
      { name: "Dive Man", dln: "DCN-031", audio: "audio/diveman.mp3" },
      { name: "Skull Man", dln: "DCN-032", audio: "audio/skullman.mp3" },
    ]
  },
  {
    id: "mm5", title: "Mega Man 5", year: 1992, composer: "Mari Yamaguchi", tracks: [
      { name: "Gravity Man", dln: "DWN-033", audio: "audio/gravityman.mp3" },
      { name: "Wave Man", dln: "DWN-034", audio: "audio/waveman.mp3" },
      { name: "Stone Man", dln: "DWN-035", audio: "audio/stoneman.mp3" },
      { name: "Gyro Man", dln: "DWN-036", audio: "audio/gyroman.mp3" },
      { name: "Star Man", dln: "DWN-037", audio: "audio/starman.mp3" },
      { name: "Charge Man", dln: "DWN-038", audio: "audio/chargeman.mp3" },
      { name: "Napalm Man", dln: "DWN-039", audio: "audio/napalmman.mp3" },
      { name: "Crystal Man", dln: "DWN-040", audio: "audio/crystalman.mp3" },
    ]
  },
  {
    id: "mm6", title: "Mega Man 6", year: 1993, composer: "Yuko Takehara", tracks: [
      { name: "Blizzard Man", dln: "MXN-041", audio: "audio/blizzardman.mp3" },
      { name: "Centaur Man", dln: "MXN-042", audio: "audio/centaurman.mp3" },
      { name: "Flame Man", dln: "MXN-043", audio: "audio/flameman.mp3" },
      { name: "Knight Man", dln: "MXN-044", audio: "audio/knightman.mp3" },
      { name: "Plant Man", dln: "MXN-045", audio: "audio/plantman.mp3" },
      { name: "Tomahawk Man", dln: "MXN-046", audio: "audio/tomahawkman.mp3" },
      { name: "Yamato Man", dln: "MXN-047", audio: "audio/yamatoman.mp3" },
      { name: "Wind Man", dln: "MXN-048", audio: "audio/windman.mp3" },
    ]
  },
  {
    id: "mm7", title: "Mega Man 7", year: 1995, composer: "Toshihiko Horiyama, Yuko Takehara & Makoto Tomozawa", tracks: [
      { name: "Freeze Man", dln: "DWN-049", audio: "audio/freezeman.mp3" },
      { name: "Junk Man", dln: "DWN-050", audio: "audio/junkman.mp3" },
      { name: "Burst Man", dln: "DWN-051", audio: "audio/burstman.mp3" },
      { name: "Cloud Man", dln: "DWN-052", audio: "audio/cloudman.mp3" },
      { name: "Spring Man", dln: "DWN-053", audio: "audio/springman.mp3" },
      { name: "Slash Man", dln: "DWN-054", audio: "audio/slashman.mp3" },
      { name: "Shade Man", dln: "DWN-055", audio: "audio/shademan.mp3" },
      { name: "Turbo Man", dln: "DWN-056", audio: "audio/turboman.mp3" },
    ]
  },
  {
    id: "mm8", title: "Mega Man 8", year: 1996, composer: "Shusaku Uchiyama", tracks: [
      { name: "Tengu Man (PS)", dln: "DWN-057", audio: "audio/mm8-tenguman-ps.mp3" },
      { name: "Tengu Man (SS)", dln: "DWN-057", audio: "audio/mm8-tenguman-ss.mp3", composer: "composer unknown" },
      { name: "Astro Man", dln: "DWN-058", audio: "audio/mm8-astroman.mp3" },
      { name: "Sword Man", dln: "DWN-059", audio: "audio/mm8-swordman.mp3" },
      { name: "Clown Man", dln: "DWN-060", audio: "audio/mm8-clownman.mp3" },
      { name: "Search Man", dln: "DWN-061", audio: "audio/mm8-searchman.mp3" },
      { name: "Frost Man", dln: "DWN-062", audio: "audio/mm8-frostman.mp3" },
      { name: "Grenade Man", dln: "DWN-063", audio: "audio/mm8-grenademan.mp3" },
      { name: "Aqua Man", dln: "DWN-064", audio: "audio/mm8-aquaman.mp3" },
    ]
  },
  {
    id: "mm9", title: "Mega Man 9", year: 2008, composer: "Ippo Yamada, Ryo Kawakami, Yu Shimoda & Hiroki Isogai", tracks: [
      { name: "Concrete Man", dln: "DLN-065", audio: "audio/concreteman.mp3" },
      { name: "Tornado Man", dln: "DLN-066", audio: "audio/tornadoman.mp3", composer: "Ippo Yamada" },
      { name: "Splash Woman", dln: "DLN-067", audio: "audio/splashwoman.mp3" },
      { name: "Plug Man", dln: "DLN-068", audio: "audio/plugman.mp3", composer: "Ryo Kawakami" },
      { name: "Jewel Man", dln: "DLN-069", audio: "audio/jewelman.mp3", composer: "Hiroki Isogai" },
      { name: "Hornet Man", dln: "DLN-070", audio: "audio/hornetman.mp3", composer: "Hiroki Isogai" },
      { name: "Magma Man", dln: "DLN-071", audio: "audio/magmaman.mp3", composer: "Ryo Kawakami" },
      { name: "Galaxy Man", dln: "DLN-072", audio: "audio/galaxyman.mp3" },
    ]
  },
  {
    id: "mm10", title: "Mega Man 10", year: 2010, composer: "Ippo Yamada, Ryo Kawakami, Hiroki Isogai & guest series composers", tracks: [
      { name: "Blade Man", dln: "DWN-073", audio: "audio/blademan.mp3", composer: "Akari Kaida" },
      { name: "Pump Man", dln: "DWN-074", audio: "audio/pumpman.mp3", composer: "Yuko Takehara" },
      { name: "Commando Man", dln: "DWN-075", audio: "audio/commandoman.mp3", composer: "Minae Fujii" },
      { name: "Chill Man", dln: "DWN-076", audio: "audio/chillman.mp3", composer: "Shusaku Uchiyama" },
      { name: "Sheep Man", dln: "DWN-077", audio: "audio/sheepman.mp3", composer: "Mari Yamaguchi" },
      { name: "Strike Man", dln: "DWN-078", audio: "audio/strikeman.mp3", composer: "Makoto Tomozawa" },
      { name: "Nitro Man", dln: "DWN-079", audio: "audio/nitroman.mp3", composer: "Manami Matsumae" },
      { name: "Solar Man", dln: "DWN-080", audio: "audio/solarman.mp3", composer: "Yasuaki Fujita" },
    ]
  },
  {
    id: "mm11", title: "Mega Man 11", year: 2018, composer: "Marika Suzuki", tracks: [
      { name: "Block Man", dln: "DWN-081", audio: "audio/blockman.mp3" },
      { name: "Fuse Man", dln: "DWN-082", audio: "audio/fuseman.mp3" },
      { name: "Blast Man", dln: "DWN-083", audio: "audio/blastman.mp3" },
      { name: "Acid Man", dln: "DWN-084", audio: "audio/acidman.mp3" },
      { name: "Tundra Man", dln: "DWN-085", audio: "audio/tundraman.mp3" },
      { name: "Torch Man", dln: "DWN-086", audio: "audio/torchman.mp3" },
      { name: "Impact Man", dln: "DWN-087", audio: "audio/impactman.mp3" },
      { name: "Bounce Man", dln: "DWN-088", audio: "audio/bounceman.mp3" },
    ]
  },
  {
    id: "mmii", title: "Mega Man II", year: 1991, composer: "Kenji Yamazaki", tracks: [
      { name: "Metal Man", dln: "DWN-009", audio: "audio/mmii-metalman.mp3", composer: "arr. Kenji Yamazaki · orig. Takashi Tateishi" },
      { name: "Air Man", dln: "DWN-010", audio: "audio/mmii-airman.mp3", composer: "arr. Kenji Yamazaki · orig. Takashi Tateishi" },
      { name: "Crash Man", dln: "DWN-013", audio: "audio/mmii-crashman.mp3", composer: "arr. Kenji Yamazaki · orig. Takashi Tateishi" },
      { name: "Wood Man", dln: "DWN-016", audio: "audio/mmii-woodman.mp3", composer: "arr. Kenji Yamazaki · orig. Takashi Tateishi" },
      { name: "Needle Man", dln: "DWN-017", audio: "audio/mmii-needleman.mp3", composer: "arr. Kenji Yamazaki · orig. Harumi Fujita" },
      { name: "Magnet Man", dln: "DWN-018", audio: "audio/mmii-magnetman.mp3", composer: "arr. Kenji Yamazaki · orig. Yasuaki Fujita" },
      { name: "Hard Man", dln: "DWN-020", audio: "audio/mmii-hardman.mp3", composer: "arr. Kenji Yamazaki · orig. Yasuaki Fujita" },
      { name: "Top Man", dln: "DWN-021", audio: "audio/mmii-topman.mp3", composer: "arr. Kenji Yamazaki · orig. Yasuaki Fujita" },
    ]
  },
  // Stardroids have no robot master serials; listed in stage order (first four, then the second four)
  {
    id: "mmv", title: "Mega Man V", year: 1994, composer: "Kouji Murata", tracks: [
      { name: "Mercury", dln: "Stardroid", audio: "audio/mmv-mercury.mp3" },
      { name: "Venus", dln: "Stardroid", audio: "audio/mmv-venus.mp3" },
      { name: "Mars", dln: "Stardroid", audio: "audio/mmv-mars.mp3" },
      { name: "Neptune", dln: "Stardroid", audio: "audio/mmv-neptune.mp3" },
      { name: "Jupiter", dln: "Stardroid", audio: "audio/mmv-jupiter.mp3" },
      { name: "Saturn", dln: "Stardroid", audio: "audio/mmv-saturn.mp3" },
      { name: "Uranus", dln: "Stardroid", audio: "audio/mmv-uranus.mp3" },
      { name: "Pluto", dln: "Stardroid", audio: "audio/mmv-pluto.mp3" },
    ]
  },
  {
    id: "mmb", title: "Mega Man & Bass", year: 1998, composer: "Toshihiko Horiyama, Naoshi Mizuta & Akari Kaida", tracks: [
      { name: "Tengu Man", dln: "DWN-057", audio: "audio/mmb-tenguman.mp3", composer: "Akari Kaida" },
      { name: "Astro Man", dln: "DWN-058", audio: "audio/mmb-astroman.mp3" },
      { name: "Cold Man", dln: "SWN-001", audio: "audio/mmb-coldman.mp3" },
      { name: "Ground Man", dln: "SWN-002", audio: "audio/mmb-groundman.mp3", composer: "Akari Kaida" },
      { name: "Pirate Man", dln: "SWN-003", audio: "audio/mmb-pirateman.mp3" },
      { name: "Burner Man", dln: "SWN-004", audio: "audio/mmb-burnerman.mp3" },
      { name: "Magic Man", dln: "SWN-005", audio: "audio/mmb-magicman.mp3" },
      { name: "Dynamo Man", dln: "KGN-001", audio: "audio/mmb-dynamoman.mp3" },
    ]
  },
  // Upcoming game: year, serials and most robot masters not announced yet; "???" are placeholders from the doc
  {
    id: "mmdo", title: "Mega Man Dual Override", year: null, tracks: [
      { name: "Twinkle Girl", dln: "TBA" },
      { name: "Jet Man", dln: "TBA" },
      { name: "???", dln: "TBA" },
      { name: "???", dln: "TBA" },
      { name: "???", dln: "TBA" },
      { name: "???", dln: "TBA" },
      { name: "???", dln: "TBA" },
      { name: "???", dln: "TBA" },
    ]
  },
];
