Offline Owl
===========


I really like [Duolingo]; however, even as a [Plus](https://www.duolingo.com/plus) subscriber,
their amazing [dictionary] remains online-only, which prevents me from looking up words
I have forgotten on-the-go while in Korea. Additionally, some courses (such as the Korean one)
do not have lessons built into the app, and therefore cannot be studied offline.

This repository provides two projects:
- In [`bin`](./bin), a Node.JS CLI app can scrape a Duolingo course to export all
  vocabulary and lessons from it, generating a `.dat` file.
- In [`app`](./app), an offline-first PWA that can query the generated `.dat` file
  is provided.

Since recent JavaScript features are used throughout the project, both the browser
and Node.JS must have relatively recent versions.


[Duolingo]: https://duolingo.com
[dictionary]: https://www.duolingo.com/dictionary
