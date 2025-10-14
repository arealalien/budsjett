export function canInvite(role) {
    return role === 'OWNER' || role === 'ADMIN';
}