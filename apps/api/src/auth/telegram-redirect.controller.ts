import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

import { Public } from './decorators/public.decorator.js';

/**
 * Handles Telegram OAuth redirect at the root URL.
 *
 * Telegram returns auth data as a hash fragment: /#tgAuthResult=base64(json)
 * Hash fragments are client-side only — the server can't see them.
 * This controller serves a small HTML page that extracts the data
 * and redirects to /api/auth/telegram/callback with query params.
 */
@ApiExcludeController()
@Controller()
export class TelegramRedirectController {
  @Public()
  @Get()
  handleRoot(@Res() res: Response): void {
    res.removeHeader('Content-Security-Policy');
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><title>Redirecting...</title></head>
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
