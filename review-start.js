// Redirect to the actual application, not a simulated responsive test page.
Store.init();Store.save(s=>s.preferences.theme='dark');
location.replace('index.html?qa=visual-dark#subir');
