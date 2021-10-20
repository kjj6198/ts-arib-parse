## ARIB STD-B24 parser

A simple parser that can parse [ARIB STD-B24](https://www.arib.or.jp/kikaku/kikaku_hoso/std-b24.html) subtitle format in MPEG-TS stream.

This implementation leverages JavaScript [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) to do the decoding.

## How it works

Every mpeg-ts packet has fixed size bytes data, every packet can different meaning based on the pid. This implementation will analyze the pid and packet data, and feed it into TextDecoder.

## TODOs

  - [ ] Realtime parsing
  - [ ] Table 7-14: control function
  - [ ] Positioning
  - [ ] color map and styling parsing
