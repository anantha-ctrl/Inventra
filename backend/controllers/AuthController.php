<?php
class AuthController extends Controller
{
    private User $users;

    public function __construct()
    {
        $this->users = new User();
    }

    public function login(Request $req): void
    {
        $this->validate($req, ['email' => 'required|email', 'password' => 'required']);

        $user = $this->users->findByEmailWithRole($req->input('email'));
        if (!$user || !password_verify($req->input('password'), $user['password'])) {
            Response::error('Invalid email or password', 401);
        }
        if ($user['status'] !== 'active') {
            Response::error('Your account is inactive. Contact an administrator.', 403);
        }

        $this->users->update((int) $user['id'], ['last_login' => date('Y-m-d H:i:s')]);

        $token = JWT::encode([
            'sub'   => (int) $user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'],
        ]);

        ActivityLogger::log((int) $user['id'], 'login', 'auth', $user['name'] . ' logged in');

        Response::success([
            'token' => $token,
            'user'  => [
                'id'    => (int) $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'phone' => $user['phone'],
                'role'  => $user['role'],
                'avatar'=> $user['avatar'],
                'permissions' => $this->users->resolvePermissions($user),
            ],
        ], 'Login successful');
    }

    public function me(Request $req): void
    {
        $user = $this->users->findWithRole($this->userId($req));
        if (!$user) Response::error('User not found', 404);
        $user['permissions'] = $this->users->resolvePermissions($user);
        unset($user['password'], $user['reset_token']);
        Response::success($user);
    }

    public function updateProfile(Request $req): void
    {
        $this->validate($req, [
            'name'  => 'required|max:120',
            'email' => 'required|email',
        ]);
        $id = $this->userId($req);
        
        $existing = $this->users->findBy('email', $req->input('email'));
        if ($existing && (int)$existing['id'] !== $id) {
            Response::error('Email already registered by another user', 409);
        }

        $data = [
            'name'  => $req->input('name'),
            'email' => $req->input('email'),
            'phone' => $req->input('phone'),
        ];
        
        $this->users->update($id, $data);
        ActivityLogger::log($id, 'update', 'user', 'Updated profile information');
        
        $user = $this->users->findWithRole($id);
        unset($user['password'], $user['reset_token']);
        Response::success($user, 'Profile updated successfully');
    }

    public function uploadAvatar(Request $req): void
    {
        $id = $this->userId($req);
        if (empty($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            Response::error('No image file uploaded', 400);
        }

        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
        $mime    = mime_content_type($_FILES['avatar']['tmp_name']);
        if (!isset($allowed[$mime])) {
            Response::error('Invalid image type. Only JPG, PNG, WEBP, and GIF are allowed.', 422);
        }
        if ($_FILES['avatar']['size'] > 2 * 1024 * 1024) {
            Response::error('Image must be under 2MB', 422);
        }

        $dir = UPLOAD_DIR . DIRECTORY_SEPARATOR . 'avatars';
        if (!is_dir($dir)) mkdir($dir, 0777, true);

        $name = 'avatar_' . $id . '_' . time() . '.' . $allowed[$mime];
        
        // Delete old avatar file if it exists
        $user = $this->users->find($id);
        if ($user && !empty($user['avatar'])) {
            $oldPath = UPLOAD_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $user['avatar']);
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
        }

        if (move_uploaded_file($_FILES['avatar']['tmp_name'], $dir . DIRECTORY_SEPARATOR . $name)) {
            $avatarPath = 'avatars/' . $name;
            $this->users->update($id, ['avatar' => $avatarPath]);
            ActivityLogger::log($id, 'update', 'user', 'Updated profile picture');
            
            $updatedUser = $this->users->findWithRole($id);
            unset($updatedUser['password'], $updatedUser['reset_token']);
            Response::success($updatedUser, 'Profile picture updated successfully');
        } else {
            Response::error('Failed to save uploaded file', 500);
        }
    }

    public function deleteAvatar(Request $req): void
    {
        $id = $this->userId($req);
        $user = $this->users->find($id);
        if ($user && !empty($user['avatar'])) {
            $oldPath = UPLOAD_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $user['avatar']);
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
            $this->users->update($id, ['avatar' => null]);
            ActivityLogger::log($id, 'update', 'user', 'Removed profile picture');
        }
        
        $updatedUser = $this->users->findWithRole($id);
        unset($updatedUser['password'], $updatedUser['reset_token']);
        Response::success($updatedUser, 'Profile picture removed successfully');
    }

    public function logout(Request $req): void
    {
        ActivityLogger::log($this->userId($req), 'logout', 'auth', ($req->user['name'] ?? 'User') . ' logged out');
        Response::success(null, 'Logged out');
    }

    public function changePassword(Request $req): void
    {
        $this->validate($req, [
            'current_password' => 'required',
            'new_password'     => 'required|min:6',
        ]);
        $user = $this->users->find($this->userId($req));
        if (!$user || !password_verify($req->input('current_password'), $user['password'])) {
            Response::error('Current password is incorrect', 422);
        }
        $this->users->update((int) $user['id'], [
            'password' => password_hash($req->input('new_password'), PASSWORD_BCRYPT),
        ]);
        ActivityLogger::log((int) $user['id'], 'update', 'auth', 'Changed password');
        Response::success(null, 'Password changed successfully');
    }

    public function forgotPassword(Request $req): void
    {
        $this->validate($req, ['email' => 'required|email']);
        $user = $this->users->findBy('email', $req->input('email'));
        // Always respond success to avoid email enumeration.
        if ($user) {
            $token = bin2hex(random_bytes(16));
            $this->users->update((int) $user['id'], [
                'reset_token'        => $token,
                'reset_token_expiry' => date('Y-m-d H:i:s', time() + 3600),
            ]);
            // In production an email would be dispatched. For this project we return the token in dev.
            $extra = APP_ENV === 'development' ? ['reset_token' => $token] : null;
            Response::success($extra, 'If the email exists, a reset link has been sent');
            return;
        }
        Response::success(null, 'If the email exists, a reset link has been sent');
    }

    public function resetPassword(Request $req): void
    {
        $this->validate($req, [
            'token'        => 'required',
            'new_password' => 'required|min:6',
        ]);
        $user = $this->users->findBy('reset_token', $req->input('token'));
        if (!$user || strtotime($user['reset_token_expiry']) < time()) {
            Response::error('Invalid or expired reset token', 422);
        }
        $this->users->update((int) $user['id'], [
            'password'           => password_hash($req->input('new_password'), PASSWORD_BCRYPT),
            'reset_token'        => null,
            'reset_token_expiry' => null,
        ]);
        ActivityLogger::log((int) $user['id'], 'update', 'auth', 'Reset password via token');
        Response::success(null, 'Password reset successful');
    }
}
