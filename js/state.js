const SUPABASE_URL = 'https://dsfgfmuzdmowiojngdxy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gc3yeEjsW2CzWOUdWmb7pQ_rpdaqyq5';
const supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

let jobs = loadFromLocalStorage();
let currentEditJobId = null;
let removeCvFile = false;
let currentFilter = 'all';
let searchQuery = '';
let currentPage = 1;
const rowsPerPage = 20;
let currentUser = null;
let remoteReady = false;
let isInitialLoad = true;

const CONSTANTS = {
    STATUS_MAP: {
        'applied': { label: 'Applied', badgeClass: 'badge-applied' },
        'psychotest': { label: 'Psychotest', badgeClass: 'badge-psychotest' },
        'interview-hr': { label: 'Interview HR', badgeClass: 'badge-interview-hr' },
        'interview-user': { label: 'Interview User', badgeClass: 'badge-interview-user' },
        'mcu': { label: 'MCU', badgeClass: 'badge-mcu' },
        'offering': { label: 'Offer Letter', badgeClass: 'badge-offering' },
        'accepted': { label: 'Accepted', badgeClass: 'badge-accepted' },
        'rejected': { label: 'Rejected', badgeClass: 'badge-rejected' },
        'ghosted': { label: 'Ghosted', badgeClass: 'badge-ghosted' },
        'withdrawn': { label: 'Withdrawn', badgeClass: 'badge-withdrawn' }
    }
};
