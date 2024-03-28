# file-web-streams
TODO Web streams for reading from files, supports reverse order and line-by-line reading

- [ ] new FileReadStream(path, opts): decoded characters in string chunks
- [ ] new FileReverseReadStream(path, opts): decoded characters in string chunks, from last char to first. NOT byte-wise reverse
- [ ] new FileReadLineStream(path, opts) // Deno.open(path).pipeThrough(new TextLineStream())
- [ ] new FileReverseReadLineStream(path, opts) // like fs-reverse but as a web stream
