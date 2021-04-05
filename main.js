
fetch('./test.ts').then(res => res.arrayBuffer())
.then(data => parse(data))


/**
 * 
 * @param {ArrayBuffer} data 
 */
function parse(data) {
  let no = 0;
  let pmtTable = null
  let pcrPid = null
  let captionPid = null

  let buffer = new Uint8Array(data.slice(no * 188, no * 188 + 188));

  while (buffer.byteLength === 188) {
      buffer = new Uint8Array(data.slice(no * 188, no * 188 + 188));
      if (buffer[0] !== 0x47) {
        console.log('Not a valid ts packet')
      }
      // tei
      const isError = buffer[1] & 0x80
      
      const payloadUnitStartIndicator = Boolean(buffer[1] & 0x40)
      const pid = ((buffer[1] & 0x1f) << 8) + buffer[2]
      const adaptationControl = ( buffer[3] & 0x30 ) >> 4
      const hasPayload = Boolean(adaptationControl & 0b01)
      const hasAdaption = Boolean( adaptationControl & 0b10 )
      const continutity = buffer[3] & 0x0f
      let idx = 4
      let offset = 0
      if (hasAdaption) {
        const adaptationFieldLength = buffer[idx]
        idx += 1;
    
        const pcrFlag = Boolean((buffer[idx] & 0x10) >> 4)
        if (pcrFlag && (pid === pcrPid)) {
          const pcrBase =
            ( buffer[idx + 1] << 25 ) +
            ( buffer[idx + 2] << 17 ) +
            ( buffer[idx + 3] << 9 ) +
            ( buffer[idx + 4] << 1 ) +
            ( (buffer[idx + 5] & 0x80) >> 7 )
          const pcrExt = ( buffer[idx + 5] & 0x01 ) + buffer[idx + 6]
          const timestamp = pcrBase * 300 + pcrExt
        }
        idx += adaptationFieldLength
      }
   
      if (hasPayload) {
        if (!pmtTable && pid === 0) {
          const d = buffer.slice(idx + 1)
          pmtTable = parsePAT(d)
        } else if (!captionPid && pmtTable && Array.from(pmtTable.values()).includes(pid)) {
          if (payloadUnitStartIndicator) {
            const d = buffer.slice(idx + 1);
            pcrPid = parsePCRPid(d)
            captionPid = parseCaptionPid(d)
          }
        } else if (pid === 0x0014) {
          // TODO: Time offset table
        } else if (pid === captionPid) {
          if (payloadUnitStartIndicator) {
            parseCaption(buffer.slice(idx))
          }
        }
      }
    no += 1
  }
}


function parseCaption(data) {
  const startCodePrefix = (data[0] << 16) +
    (data[1] << 8) + data[2]

  const streamId = data[3]
  const pesPacketLength = (data[4] << 8) + data[5]
  const pesHeaderDataLength = data[8]
  // =========
  // werid?
  const pesDataPacketHeaderLength = data[11 + pesHeaderDataLength] & 0x0f
  let offset = 12 + pesHeaderDataLength + pesDataPacketHeaderLength;
  let d = data.slice(offset)
  // TODO: spec
  // http://www.arib.or.jp/english/html/overview/doc/6-STD-B24v6_4-1p3-E1.pdf
  const dataGroupId = (d[0] & 0xfc) >> 2;
  const dataGroupVersion = (d[0] & 0x03) 
  const dataGroupLinkNumber = d[1]
  


  if (dataGroupId === 0x20 || dataGroupId === 0x00) {
    const numLanguages = d[6]
    console.log('lan', numLanguages)
    offset += 7 + numLanguages * 5
  } else {
    offset += 6
  }

  d = data.slice(offset)
  const dataUnitLoopLength = (d[0] << 16) + (d[1] << 8) + d[2]
  let idx = 0;

  while (idx < dataUnitLoopLength) {
    const separator = d[idx + 3]
    const dataUnitParameter = d[idx + 4]
    const dataUnitSize = (d[idx + 5] << 16) + (d[idx + 6] << 8) + d[idx + 7]
  // 0x20 - statement body
  // 0x28 - geometric
  // 0x30 - 1-byte DRCS
  // 0x31 - 2-byte DRCS
  // 0x34 - Color map
  // 0x35 - Bitmap
    if (dataUnitParameter === 0x20) {
      parseText(d.slice(5), dataUnitSize)
    }
    idx += 5 + dataUnitSize
  }
}

function parseText(data, length) {
  // TODO: have to handle a lot of case
  const str = data.slice(0, length + 1);
  let result = ''
  let i = 0
  
  while (i < length) {
    if (str[i] === 0x20) {
      i += 1
    }   
    // // JIS X 0208 (lead bytes)
    // if (str[i] > 0x20 && str[i] < 0x7f) {
      
    // }
    printInByte(str)
    if (str[i] > 0xa0 && str[i] < 0xff) {
      if (str[i] === 0x20) {
        result += ' '
      } else {
        const char = str.slice(i, i + 2);
        const decoded = new TextDecoder('EUC-JP').decode(char) 
        result += decoded
        i += 2
      }
      
    } else if (str[i] === 0x0d) {
      result += '\n'
      i += 1
    } else if (str[i] === 0x0c) {
      result += ' '
      i += 1
    } else {
      i += 1
    }

  }

  console.log(result)
  document.querySelector('#result').innerHTML += result + '<br/>'
}

function parseCaptionPid(data) {
  const tableId = data[0]
  if (tableId !== 0x02) {
    console.log('not caption table')
  }

  const sectionLength = ((data[1] & 0x0f) << 8) + data[2]
  const programInfoLength = ((data[10] & 0x0F) << 8) + data[11];
  let idx = 12 + programInfoLength

  while (idx < (3 + sectionLength - 4)) {
    const streamType = data[idx]
    const elementaryPid = ((data[idx + 1] & 0x1f) << 8) + data[idx + 2]
    const ESInfoLength = ((data[idx + 3] & 0x0f) << 8) + data[idx + 4]
    // MPEG-2 PES Private data
    if (streamType === 0x06) {
      let descriptorIdx = idx + 5
      const descriptorData = data.slice(descriptorIdx)
      while (descriptorIdx < ( idx + ESInfoLength )) {
        const descriptorTag = descriptorData[0]
        const descriptorLength = descriptorData[1]
        console.log(descriptorTag, descriptorLength)
        if (descriptorTag === 0x52) {
          console.log('stream identifier descriptor')
          const componentTag = descriptorData[2]
          console.log('tag:' , componentTag)
          if (componentTag === 0x87) {
            return elementaryPid
          }
        }
        descriptorIdx += (2 + descriptorLength)
      }
    }
    idx += 5 + ESInfoLength
  }

}
// PMT table 
function parsePCRPid(data) {
  return ((data[8] & 0x1f) << 8) + data[9]
}

function parsePAT(data) {
  const tableId = data[0]
  if (tableId !== 0x00) {
    // TODO
  }

  const sectionLength = ((data[1] & 0x0f) << 8) + data[2]
  const idx = 8;
  let i = idx;
  const pat = new Map()
  while (i < (3 + sectionLength - 4)) {
    const programNumber = (data[i] << 8) + data[i + 1];
    if (programNumber !== 0) {
      const programMapPid = ((data[i + 2] & 0x1f) << 8) + data[i + 3]
      pat.set(programNumber, programMapPid)
    }
    i += 4
  }
  console.log(pat)
  return pat

}

function printInByte(buffer) {
  let str = ''
  
  buffer.forEach((num, i) => {
    str += num.toString('16').toUpperCase().padStart(2, '0') + ' '
    if (i % 16 === 15) {
      str += '\n'
    }
  })
  console.log(str)
}