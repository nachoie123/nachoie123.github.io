// Album data shared by every page. Audio files go in assets/audio/01.mp3 … 10.mp3
const SLOW_LIGHT_CHORUS = `Oh, slow light, settle on the street,
Hum along to a half-forgotten beat.
We don't have to say a thing,
Let the evening do the singing.
Slow light, don't you rush away,
Nothing's wrong, it's just another day,
Stay a while, we're going nowhere fast,
Quiet things were made to last.`;

const TRACKS = [
  { n: 1, title: 'Tape Hiss (Intro)', type: 'Instrumental', len: '2:58', light: 'afternoon',
    suno: 'https://suno.com/song/093d8615-23f8-47fa-9b56-287a39d32804',
    notes: 'Free time settling into 104 BPM, key of G. A cassette deck clicks PLAY, tape hiss, birds through an open window. One acoustic guitar tunes its low string and lets a single G chord ring out: the same chord "Slow Light" ends on.',
    lyrics: null },
  { n: 2, title: 'Borrowed Key', type: 'Song', len: '2:49', light: 'afternoon',
    suno: 'https://suno.com/song/2c6edf2d-df0e-45ca-b83a-7ac83445d4de',
    notes: '~112 BPM, key of D. Bright jangly 12-string over strummed acoustic, tambourine on the off-beats.',
    lyrics: `[Verse 1]
Your brother's car and a borrowed key,
Half a tank and the radio free,
Windows down on the county line,
Nobody here is keeping time.
Gas station coffee, a paper map,
Feet on the dash and your hat in your lap,
We've got the whole of the afternoon,
And nowhere we have to be by June.

[Chorus]
So turn it up, turn it up, let it rattle the doors,
This road was never ours, but tonight it's ours,
Borrowed key, borrowed day,
Give it back when the light goes away.

[Verse 2]
Cut through the fields where the water towers stand,
Writing our names on the back of your hand,
The song on the radio skips a line,
We sing it wrong and it sounds just fine.

[Chorus]
So turn it up, turn it up, let it rattle the doors,
This road was never ours, but tonight it's ours,
Borrowed key, borrowed day,
Give it back when the light goes away.

[Bridge]
And if they ask where we've been,
Tell them nowhere, tell them nothing,
Tell them the engine was running,
And we were just about to begin.

[Final Chorus]
So turn it up, turn it up, let it rattle the doors,
This road was never ours, but tonight it's ours,
Borrowed key, borrowed day,
Give it back when the light goes away.

[Outro]
Borrowed key... borrowed day...` },
  { n: 3, title: 'Slow Light', type: 'Lead single', len: '3:32', light: 'afternoon', single: true,
    suno: 'https://suno.com/song/49cb741f-23e7-44d4-94c9-785047fc2bb0',
    notes: '~104 BPM, key of G. Strummed acoustic, soft fuzzy electric underneath, brushed drums, tambourine low in the mix. Half-spoken, laid-back vocal.',
    lyrics: `[Verse 1]
Left the radio on all afternoon,
Something about the light in this room,
Sleeves rolled up and the day gets slow,
You said you'd call, but I don't know.
Dust on the dashboard, a borrowed key,
Nobody's asking where we'll be,
It's warm enough to forget the time,
Everything's easy, everything's fine.

[Pre-Chorus]
And you say,
"Hey, no need to explain,
It all looks better in the rain."

[Chorus]
${SLOW_LIGHT_CHORUS}

[Verse 2]
Paint on the wall that nobody read,
Songs we started and never said,
You laugh like a screen door in the wind,
Somewhere it's over, somewhere it begins.
Empty pool and we sit on the edge,
Making a promise we won't pledge,
Voices drifting from down the road,
Out of tune but they know the code.

[Pre-Chorus]
And you say,
"Hey, no need to explain,
It all looks better in the rain."

[Chorus]
${SLOW_LIGHT_CHORUS}

[Bridge]
And the smoke in the distance, it burns so slow,
Like a thought you had and let it go,
I'll keep the afternoon on a cassette tape,
Play it back when it's getting late...

[Final Chorus]
${SLOW_LIGHT_CHORUS}

[Outro]
Mm, mm-mm, mm-mm-mm, slow light...` },
  { n: 4, title: 'Empty Pool', type: 'Song', len: '2:58', light: 'golden',
    suno: 'https://suno.com/song/54f43f12-ec8f-473e-8d03-5f53372cb340',
    notes: '~98 BPM, key of E minor. Slow strum, reverb-soaked single notes, a bridge with just bass and voice.',
    lyrics: `[Verse 1]
Leaves in the deep end, the summer's packed up,
Chlorine still hanging on a plastic cup,
We sit on the edge with our shoes untied,
Counting the cracks on the shallow side.

[Pre-Chorus]
You said next year we'll fill it again,
I said sure, but I don't know when.

[Chorus]
Empty pool, empty pool,
Nothing to swim in but the afternoon,
Hold your breath and jump on in,
Pretend the water's where it's always been.

[Verse 2]
Lifeguard chair with a rusted seat,
Your old towel drying in the heat,
Someone's dog barking over the fence,
None of this ever made much sense.

[Pre-Chorus]
You said next year we'll fill it again,
I said sure, but I don't know when.

[Chorus]
Empty pool, empty pool,
Nothing to swim in but the afternoon,
Hold your breath and jump on in,
Pretend the water's where it's always been.

[Bridge]
We were louder here, we were taller here,
Every summer felt like a whole year.

[Final Chorus]
Empty pool, empty pool,
Nothing to swim in but the afternoon,
Hold your breath and jump on in,
Pretend the water's where it's always been.

[Outro]
Hold your breath...` },
  { n: 5, title: 'Radio Static (Interlude)', type: 'Instrumental', len: '2:33', light: 'golden',
    suno: 'https://suno.com/song/63664ba7-8139-4a08-91b1-8a8847a38d91',
    notes: 'A car radio scanning stations: static, crackle, half-second voices. It lands on a warped cassette playing the "Slow Light" chorus on a clean electric guitar, slightly off-speed, then fades back into static.',
    lyrics: null },
  { n: 6, title: 'Paint on the Wall', type: 'Song', len: '2:38', light: 'golden',
    suno: 'https://suno.com/song/6c27af0d-20d1-45a2-a228-9b2c8532c52a',
    notes: '~116 BPM, key of A. The fuzzy electric comes to the front, sticks instead of brushes, the chorus almost shouted.',
    lyrics: `[Verse 1]
Back of the school where the bricks turn red,
You wrote a line that nobody read,
Spray can rattle like a tambourine,
The loudest thing that we've ever been.

[Chorus]
Paint on the wall, paint on the wall,
Says everything we never said at all,
Wash it away and it bleeds back through,
Same old words, still about you.

[Verse 2]
Black and silver and a little bit wrong,
Spelled your name like the start of a song,
Sirens somewhere, but not for us,
We missed the last of the evening bus.

[Chorus]
Paint on the wall, paint on the wall,
Says everything we never said at all,
Wash it away and it bleeds back through,
Same old words, still about you.

[Bridge]
Two coats of grey from the city crew,
Can't paint over what's already true.

[Final Chorus]
Paint on the wall, paint on the wall,
Says everything we never said at all,
Wash it away and it bleeds back through,
Same old words, still about you.

[Outro]
Still about you...` },
  { n: 7, title: 'Out of Tune', type: 'Song', len: '2:11', light: 'golden',
    suno: 'https://suno.com/song/853f2ea8-6c7b-49fb-9408-39fb9d520d03',
    notes: '~108 BPM, key of C. Porch sing-along: hand claps, a stomped kick, a cheap upright piano and four voices slightly out of tune on purpose.',
    lyrics: `[Verse 1]
Voices drifting from down the road,
Out of tune but they know the code,
Four of us and a broken chair,
One guitar that we pass round there.

[Chorus]
And we're out of tune, out of tune,
Singing it loud to the half-lit moon,
Nobody's listening, that's alright,
We'll be out of tune all night.

[Verse 2]
Hudson's got the only three chords he knows,
Mason keeps time on the porch with his toes,
Elijah whistles the part he wrote,
Noah forgets the very last note.

[Chorus]
And we're out of tune, out of tune,
Singing it loud to the half-lit moon,
Nobody's listening, that's alright,
We'll be out of tune all night.

[Bridge]
La la la, la la la la,
La la la, la la la la.

[Final Chorus]
And we're out of tune, out of tune,
Singing it loud to the half-lit moon,
Nobody's listening, that's alright,
We'll be out of tune all night.` },
  { n: 8, title: 'Porch Talk (Skit)', type: 'Spoken word', len: '0:37', light: 'night',
    suno: 'https://suno.com/song/9170aa45-532c-403d-b939-68212f9d1b91',
    notes: '2 a.m. on the porch, recorded on a cassette dictaphone. Crickets, a distant car, a screen door creaking. Ends with the STOP button.',
    lyrics: `NOAH: Is it recording?
HUDSON: The red light's on.
MASON: That doesn't mean anything, that light's always on.
ELIJAH: Say something, then.
NOAH: ...Hi. It's... what is it, two?
HUDSON: Ten past two.
NOAH: It's ten past two, and we're... we're not going anywhere.
ELIJAH: Fast.
ALL: (laughing) Going nowhere fast.
[Screen door creaks, tape clicks]` },
  { n: 9, title: 'Screen Door', type: 'Song', len: '2:32', light: 'night',
    suno: 'https://suno.com/song/e3e35f73-c98d-4212-a952-4fdf3f7008c6',
    notes: '~88 BPM, key of C. Fingerpicked acoustic alone, then brushed drums and soft bass. Almost whispered vocal, three-part harmony at the end.',
    lyrics: `[Verse 1]
You laugh like a screen door in the wind,
Swinging out and coming back again,
Porch light humming, moths in a ring,
I never learned how to say anything.

[Chorus]
Screen door, screen door,
Leave it open a little more,
I'll be on the step when you come through,
I was always waiting on you.

[Verse 2]
Summer's leaving on the evening train,
Your mom's calling you in from the rain,
You stop and turn on the bottom stair,
Like you'd say it, but you leave it there.

[Chorus]
Screen door, screen door,
Leave it open a little more,
I'll be on the step when you come through,
I was always waiting on you.

[Bridge]
And it slams, and it slams,
And it opens again.

[Final Chorus]
Screen door, screen door,
Leave it open a little more,
I'll be on the step when you come through,
I was always waiting on you.` },
  { n: 10, title: 'Nowhere Fast', type: 'Song', len: '2:27', light: 'night',
    suno: 'https://suno.com/song/fdc99bb8-ffef-4d7f-b779-812b6b5cdcbf',
    notes: '~100 BPM, key of G, the same key as "Slow Light", so the album ends where it started. Instruments drop out one by one and the cassette clicks off.',
    lyrics: `[Verse 1]
Last of the tape and the batteries low,
Streetlights blinking like they want to go,
Everyone's yawning but nobody leaves,
Smoke from the bonfire caught in our sleeves.

[Chorus]
We're going nowhere fast,
Holding on to the very last,
If this is all that the summer had,
Then honestly, it wasn't bad.

[Verse 2]
Tomorrow's a car and a city and work,
A suitcase, a train and a collared shirt,
But tonight there's a cassette left to fill,
Four of us here on the top of the hill.

[Chorus]
We're going nowhere fast,
Holding on to the very last,
If this is all that the summer had,
Then honestly, it wasn't bad.

[Bridge]
Slow light, settle down, settle down,
Quiet things are the last to leave town.

[Final Chorus]
We're going nowhere fast,
Holding on to the very last,
If this is all that the summer had,
Then honestly, it wasn't bad.` },
];

const LIGHTS = {
  afternoon: { label: 'Afternoon', range: 'Tracks 1–3' },
  golden: { label: 'Golden hour', range: 'Tracks 4–7' },
  night: { label: 'Night', range: 'Tracks 8–10' },
};

const audioSrc = t => `assets/audio/${String(t.n).padStart(2, '0')}.mp3`;
const toSeconds = len => { const [m, s] = len.split(':'); return +m * 60 + +s; };
