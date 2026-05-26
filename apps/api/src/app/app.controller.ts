import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Root controller — serves Telegram OAuth hash-fragment extractor.
 *
 * Telegram returns auth data as a hash fragment: /#tgAuthResult=base64(json)
 * Hash fragments are client-side only — the server can't see them.
 * This serves a small HTML page that extracts the data
 * and redirects to /api/auth/telegram/callback with query params.
 * If no hash fragment is present, it shows a simple API message.
 */
@Controller()
export class AppController {
  @Public()
  @Get()
  handleRoot(@Res() res: Response): void {
    res.removeHeader('Content-Security-Policy');
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><title>iHelp API</title></head>
<body>
<script>
(function() {
  var hash = window.location.hash;
  if (hash && hash.indexOf('#tgAuthResult=') === 0) {
    var data = hash.substring('#tgAuthResult='.length);
    try {
      var decoded = JSON.parse(atob(data));
      var params = new URLSearchParams();
      for (var key in decoded) { params.set(key, decoded[key]); }
      window.location.href = '/api/auth/telegram/callback?' + params.toString();
    } catch(e) {
      document.body.innerText = 'Failed to process Telegram auth data: ' + e.message;
    }
  } else {
    document.body.innerText = 'iHelp API';
  }
})();
</script>
</body>
</html>`);
  }
}
