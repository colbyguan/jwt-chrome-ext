chrome.runtime.onInstalled.addListener(() => {
  console.log('JWT EXT INSTALLED');
});

const PROTOCOLS = ['http://', 'https://'];
const TARGET_HOST = 'localhost';

// When the user clicks on the extension action
chrome.action.onClicked.addListener(async (activeTab) => {
  try {
    const jwts = await chrome.cookies.getAll(
      { url: activeTab.url },
    ).then(cookies =>
      cookies
        .filter(cookie => cookie.name.startsWith('jwt') || cookie.name.startsWith('_jwt'))
        .map(cookie => {
          delete cookie.session;
          delete cookie.hostOnly;
          return { ...cookie, domain: TARGET_HOST }
        })
    );

    const allTabs = await chrome.tabs.query({})
    const localhostTabs = allTabs.filter(tab => {
      const host = PROTOCOLS.reduce((host, protocol) =>
        tab.url.startsWith(protocol) ? tab.url.slice(protocol.length) : host,
        undefined,
      );
      return tab.url !== activeTab.url && host?.startsWith(TARGET_HOST);
    })

    chrome.runtime.onMessage.addListener(
      function handleConfirm(request) {
        if (request.confirmed === true) {
          localhostTabs.forEach(tab => {
            jwts.forEach(jwt => chrome.cookies.set({ ...jwt, url: tab.url }));
          })

          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            function: (jwts, urls) => {
              const jwtsDisplay = jwts.map(jwt => `  ${jwt.name}=${jwt.value.slice(0, 30)}...`).join('\n')
              alert(`INJECTED\n${jwtsDisplay}\nINTO\n${urls.map(url => '  ' + url).join('\n')}`);
            },
            args: [jwts, localhostTabs.map(tab => tab.url)],
          });
        }

        if (typeof request.confirmed === 'boolean') {
          chrome.runtime.onMessage.removeListener(handleConfirm)
        }
      });

    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: (localhostTabs, activeTab) => {
        const confirmed = confirm(`Inject JWT from this page (${activeTab.url}) into these tabs?\n\n${localhostTabs.map(tab => ' - ' + tab.url).join('\n')}`)
        chrome.runtime.sendMessage({ confirmed }, null);
      },
      args: [localhostTabs, activeTab],
    });


  } catch (err) {
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: (err) => alert('Error copying jwt'),
      args: [err],
    });
  }
});
