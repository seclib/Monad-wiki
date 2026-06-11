/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import BenchmarkController from '#controllers/benchmark_controller'
import AiController from '#controllers/ai_controller'
import ChatsController from '#controllers/chats_controller'
import DocsController from '#controllers/docs_controller'
import DownloadsController from '#controllers/downloads_controller'
import EasySetupController from '#controllers/easy_setup_controller'
import HomeController from '#controllers/home_controller'
import LocalLifeController from '#controllers/local_life_controller'
import MapsController from '#controllers/maps_controller'
import OllamaController from '#controllers/ollama_controller'
import RagController from '#controllers/rag_controller'
import SettingsController from '#controllers/settings_controller'
import SystemController from '#controllers/system_controller'
import CollectionUpdatesController from '#controllers/collection_updates_controller'
import ZimController from '#controllers/zim_controller'
import WikiIntelligenceController from '#controllers/wiki_intelligence_controller'
import VaultController from '#controllers/vault_controller'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'

transmit.registerRoutes()

router.get('/', [HomeController, 'index'])
router.get('/home', [HomeController, 'home'])
router.on('/about').renderInertia('about')
router.get('/chat', [ChatsController, 'inertia'])
router.get('/maps', [MapsController, 'index'])
router.get('/local-life', [LocalLifeController, 'dashboardPage'])
router.get('/local-life/documents', [LocalLifeController, 'documentsPage'])
router.get('/local-life/notes', [LocalLifeController, 'notesPage'])
router.get('/local-life/services', [LocalLifeController, 'servicesPage'])
router.on('/knowledge-base').redirectToPath('/chat?knowledge_base=true') // redirect for legacy knowledge-base links

router.get('/easy-setup', [EasySetupController, 'index'])
router.get('/easy-setup/complete', [EasySetupController, 'complete'])
router.get('/api/easy-setup/curated-categories', [EasySetupController, 'listCuratedCategories'])
router.post('/api/manifests/refresh', [EasySetupController, 'refreshManifests'])
router
  .group(() => {
    router.post('/check', [CollectionUpdatesController, 'checkForUpdates'])
    router.post('/apply', [CollectionUpdatesController, 'applyUpdate'])
    router.post('/apply-all', [CollectionUpdatesController, 'applyAllUpdates'])
  })
  .prefix('/api/content-updates')

router
  .group(() => {
    router.get('/system', [SettingsController, 'system'])
    router.get('/apps', [SettingsController, 'apps'])
    router.get('/legal', [SettingsController, 'legal'])
    router.get('/maps', [SettingsController, 'maps'])
    router.get('/models', [SettingsController, 'models'])
    router.get('/update', [SettingsController, 'update'])
    router.get('/zim', [SettingsController, 'zim'])
    router.get('/zim/remote-explorer', [SettingsController, 'zimRemote'])
    router.get('/benchmark', [SettingsController, 'benchmark'])
    router.get('/support', [SettingsController, 'support'])
  })
  .prefix('/settings')

router
  .group(() => {
    router.get('/:slug', [DocsController, 'show'])
    router.get('/', ({ response }) => {
      // redirect to /docs/home if accessing root
      response.redirect('/docs/home')
    })
  })
  .prefix('/docs')

router
  .group(() => {
    router.get('/regions', [MapsController, 'listRegions'])
    router.get('/styles', [MapsController, 'styles'])
    router.get('/curated-collections', [MapsController, 'listCuratedCollections'])
    router.post('/fetch-latest-collections', [MapsController, 'fetchLatestCollections'])
    router.post('/download-base-assets', [MapsController, 'downloadBaseAssets'])
    router.post('/download-remote', [MapsController, 'downloadRemote'])
    router.post('/download-remote-preflight', [MapsController, 'downloadRemotePreflight'])
    router.post('/download-collection', [MapsController, 'downloadCollection'])
    router.get('/global-map-info', [MapsController, 'globalMapInfo'])
    router.post('/download-global-map', [MapsController, 'downloadGlobalMap'])
    router.get('/countries', [MapsController, 'listCountries'])
    router.get('/country-groups', [MapsController, 'listCountryGroups'])
    router.post('/extract-preflight', [MapsController, 'extractPreflight'])
    router.post('/extract', [MapsController, 'extractRegion'])
    router.get('/markers', [MapsController, 'listMarkers'])
    router.post('/markers', [MapsController, 'createMarker'])
    router.patch('/markers/:id', [MapsController, 'updateMarker'])
    router.delete('/markers/:id', [MapsController, 'deleteMarker'])
    router.delete('/:filename', [MapsController, 'delete'])
  })
  .prefix('/api/maps')

router
  .group(() => {
    router.get('/list', [DocsController, 'list'])
  })
  .prefix('/api/docs')

router
  .group(() => {
    router.get('/dashboard', [LocalLifeController, 'dashboard'])
    router.get('/search', [LocalLifeController, 'unifiedSearch'])

    router.get('/docs', [LocalLifeController, 'listDocuments'])
    router.post('/docs', [LocalLifeController, 'uploadDocument'])
    router.get('/docs/:id/download', [LocalLifeController, 'downloadDocument'])
    router.patch('/docs/:id', [LocalLifeController, 'updateDocument'])
    router.delete('/docs/:id', [LocalLifeController, 'deleteDocument'])

    router.get('/notes', [LocalLifeController, 'listNotes'])
    router.post('/notes', [LocalLifeController, 'createNote'])
    router.patch('/notes/:id', [LocalLifeController, 'updateNote'])
    router.delete('/notes/:id', [LocalLifeController, 'deleteNote'])

    router.get('/services', [LocalLifeController, 'listServices'])
    router.post('/services', [LocalLifeController, 'createService'])
    router.patch('/services/:id', [LocalLifeController, 'updateService'])
    router.delete('/services/:id', [LocalLifeController, 'deleteService'])

    router.get('/reminders', [LocalLifeController, 'listReminders'])
    router.post('/reminders', [LocalLifeController, 'createReminder'])
    router.patch('/reminders/:id', [LocalLifeController, 'updateReminder'])
    router.delete('/reminders/:id', [LocalLifeController, 'deleteReminder'])
  })
  .prefix('/api/local-life')

router
  .group(() => {
    router.get('/jobs', [DownloadsController, 'index'])
    router.get('/jobs/:filetype', [DownloadsController, 'filetype'])
    router.delete('/jobs/:jobId', [DownloadsController, 'removeJob'])
    router.post('/jobs/:jobId/cancel', [DownloadsController, 'cancelJob'])
  })
  .prefix('/api/downloads')

router.get('/api/health', () => {
  return { status: 'ok' }
})

router
  .group(() => {
    router.post('/chat', [OllamaController, 'chat'])
    router.get('/models', [OllamaController, 'availableModels'])
    router.post('/models', [OllamaController, 'dispatchModelDownload'])
    router.delete('/models', [OllamaController, 'deleteModel'])
    router.get('/installed-models', [OllamaController, 'installedModels'])
    router.post('/unload-chat-models', [OllamaController, 'unloadChatModels'])
    router.post('/configure-remote', [OllamaController, 'configureRemote'])
    router.get('/remote-status', [OllamaController, 'remoteStatus'])
  })
  .prefix('/api/ollama')

router
  .group(() => {
    router.get('/', [ChatsController, 'index'])
    router.post('/', [ChatsController, 'store'])
    router.delete('/all', [ChatsController, 'destroyAll'])
    router.get('/:id', [ChatsController, 'show'])
    router.put('/:id', [ChatsController, 'update'])
    router.delete('/:id', [ChatsController, 'destroy'])
    router.post('/:id/messages', [ChatsController, 'addMessage'])
  })
  .prefix('/api/chat/sessions')

router.get('/api/chat/suggestions', [ChatsController, 'suggestions'])

router.post('/search/semantic', [WikiIntelligenceController, 'semanticSearch'])
router.post('/wiki/ask', [WikiIntelligenceController, 'ask'])
router.post('/wiki/summarize', [WikiIntelligenceController, 'summarize'])
router.post('/wiki/related', [WikiIntelligenceController, 'related'])
router.post('/wiki/tags', [WikiIntelligenceController, 'tags'])
router.post('/api/search/semantic', [WikiIntelligenceController, 'semanticSearch'])
router.post('/api/wiki/ask', [WikiIntelligenceController, 'ask'])
router.post('/api/wiki/summarize', [WikiIntelligenceController, 'summarize'])
router.post('/api/wiki/related', [WikiIntelligenceController, 'related'])
router.post('/api/wiki/tags', [WikiIntelligenceController, 'tags'])

router.post('/ai/query', [AiController, 'query'])
router.get('/vault/status', [VaultController, 'status'])
router.get('/vault/index/status', [VaultController, 'indexStatus'])
router.post('/vault/index', [VaultController, 'index'])
router.post('/vault/save', [VaultController, 'save'])
router.get('/vault/list', [VaultController, 'list'])
router.get('/vault/search', [VaultController, 'search'])
router.post('/vault/search/semantic', [VaultController, 'semanticSearch'])
router.post('/vault/ask', [VaultController, 'ask'])
router.post('/api/ai/query', [AiController, 'query'])
router.get('/api/vault/status', [VaultController, 'status'])
router.get('/api/vault/index/status', [VaultController, 'indexStatus'])
router.post('/api/vault/index', [VaultController, 'index'])
router.post('/api/vault/save', [VaultController, 'save'])
router.get('/api/vault/list', [VaultController, 'list'])
router.get('/api/vault/search', [VaultController, 'search'])
router.post('/api/vault/search/semantic', [VaultController, 'semanticSearch'])
router.post('/api/vault/ask', [VaultController, 'ask'])

router
  .group(() => {
    router.post('/upload', [RagController, 'upload'])
    router.get('/files', [RagController, 'getStoredFiles'])
    router.get('/file-warnings', [RagController, 'getFileWarnings'])
    router.delete('/files', [RagController, 'deleteFile'])
    router.post('/files/embed', [RagController, 'embedFile'])
    router.get('/active-jobs', [RagController, 'getActiveJobs'])
    router.get('/failed-jobs', [RagController, 'getFailedJobs'])
    router.delete('/failed-jobs', [RagController, 'cleanupFailedJobs'])
    router.get('/job-status', [RagController, 'getJobStatus'])
    router.post('/sync', [RagController, 'scanAndSync'])
    router.post('/re-embed-all', [RagController, 'reembedAll'])
    router.post('/reset-and-rebuild', [RagController, 'resetAndRebuild'])
    router.post('/estimate-batch', [RagController, 'estimateBatch'])
    router.get('/policy-prompt-state', [RagController, 'policyPromptState'])
    router.get('/health', [RagController, 'health'])
  })
  .prefix('/api/rag')

router
  .group(() => {
    router.get('/debug-info', [SystemController, 'getDebugInfo'])
    router.get('/info', [SystemController, 'getSystemInfo'])
    router.get('/internet-status', [SystemController, 'getInternetStatus'])
    router.get('/offline-status', [SystemController, 'getOfflineStatus'])
    router.get('/services', [SystemController, 'getServices'])
    router.post('/services/affect', [SystemController, 'affectService'])
    router.post('/services/install', [SystemController, 'installService'])
    router.post('/services/force-reinstall', [SystemController, 'forceReinstallService'])
    router.post('/services/check-updates', [SystemController, 'checkServiceUpdates'])
    router.get('/services/:name/available-versions', [SystemController, 'getAvailableVersions'])
    router.post('/services/update', [SystemController, 'updateService'])
    router.post('/subscribe-release-notes', [SystemController, 'subscribeToReleaseNotes'])
    router.get('/latest-version', [SystemController, 'checkLatestVersion'])
    router.post('/update', [SystemController, 'requestSystemUpdate'])
    router.get('/update/status', [SystemController, 'getSystemUpdateStatus'])
    router.get('/update/logs', [SystemController, 'getSystemUpdateLogs'])
    router.get('/settings', [SettingsController, 'getSetting'])
    router.patch('/settings', [SettingsController, 'updateSetting'])
  })
  .prefix('/api/system')

router
  .group(() => {
    router.get('/list', [ZimController, 'list'])
    router.get('/list-remote', [ZimController, 'listRemote'])
    router.get('/curated-categories', [ZimController, 'listCuratedCategories'])
    router.post('/download-remote', [ZimController, 'downloadRemote'])
    router.post('/download-category-tier', [ZimController, 'downloadCategoryTier'])

    router.get('/wikipedia', [ZimController, 'getWikipediaState'])
    router.post('/wikipedia/select', [ZimController, 'selectWikipedia'])

    router.get('/custom-libraries', [ZimController, 'listCustomLibraries'])
    router.post('/custom-libraries', [ZimController, 'addCustomLibrary'])
    router.delete('/custom-libraries/:id', [ZimController, 'removeCustomLibrary'])
    router.get('/browse-library', [ZimController, 'browseLibrary'])

    router.delete('/:filename', [ZimController, 'delete'])
  })
  .prefix('/api/zim')

router
  .group(() => {
    router.post('/run', [BenchmarkController, 'run'])
    router.post('/run/system', [BenchmarkController, 'runSystem'])
    router.post('/run/ai', [BenchmarkController, 'runAI'])
    router.get('/results', [BenchmarkController, 'results'])
    router.get('/results/latest', [BenchmarkController, 'latest'])
    router.get('/results/:id', [BenchmarkController, 'show'])
    router.post('/submit', [BenchmarkController, 'submit'])
    router.post('/builder-tag', [BenchmarkController, 'updateBuilderTag'])
    router.get('/comparison', [BenchmarkController, 'comparison'])
    router.get('/status', [BenchmarkController, 'status'])
    router.get('/settings', [BenchmarkController, 'settings'])
    router.post('/settings', [BenchmarkController, 'updateSettings'])
  })
  .prefix('/api/benchmark')
