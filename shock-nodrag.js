/* SHOCK Male Grooming — il logo non deve mai essere trascinabile.
   Il logo compare in molti punti (header, footer, menu mobile, pannello
   admin, pagina di attesa) sia in markup statico che renderizzato da
   React: invece di toccare ogni occorrenza una per una, un solo
   listener a livello di documento intercetta qualunque tentativo di
   trascinamento su un'immagine il cui src contiene "logo", ovunque e
   comunque sia stata inserita nella pagina. */
(function () {
  var st = document.createElement('style');
  st.textContent =
    'img[src*="logo"]{-webkit-user-drag:none;user-drag:none;' +
    '-khtml-user-drag:none;-moz-user-select:none;user-select:none}';
  (document.head || document.documentElement).appendChild(st);

  document.addEventListener(
    'dragstart',
    function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG' && /logo/i.test(t.currentSrc || t.src || '')) {
        e.preventDefault();
      }
    },
    true
  );
})();
