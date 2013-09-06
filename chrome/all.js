// This won't be needed the day Chrome implements
// DOMFrameContentLoaded or equivalent.

// Also, because of a Webkit bug we can't just try/catch a security
// exception here to stop execution when the frame origin differs from
// the top origin.  Below, the first two explicit tests avoid an
// annoying unsuppressable error message sent to the console in known
// cases; the third deals with unexpecteds. See
// https://code.google.com/p/chromium/issues/detail?id=17325

if(self.location.hostname != 'chat.pardus.at' &&
   self.location.hostname != 'forum.pardus.at' &&
   self.location.origin == top.location.origin) {
document.addEventListener
('DOMContentLoaded',
 function() {
     var location = document.location, frame = window.frameElement,
     fid = frame ? frame.id : null;
     top.postMessage({ sgpvp: 2, url: location.href, frame: fid },
                     location.origin);
 },
 false);
}
