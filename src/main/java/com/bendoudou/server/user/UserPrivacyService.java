package com.bendoudou.server.user;

import com.bendoudou.server.user.dto.UpdateUserPrivacySettingsRequest;
import com.bendoudou.server.user.dto.UserPrivacySettingsResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class UserPrivacyService {

    private final UserPrivacySettingRepository userPrivacySettingRepository;
    private final UserLoginRecordRepository userLoginRecordRepository;

    public UserPrivacyService(
            UserPrivacySettingRepository userPrivacySettingRepository,
            UserLoginRecordRepository userLoginRecordRepository
    ) {
        this.userPrivacySettingRepository = userPrivacySettingRepository;
        this.userLoginRecordRepository = userLoginRecordRepository;
    }

    @Transactional(readOnly = true)
    public UserPrivacySettingsResponse getSettings(long userId) {
        UserPrivacySetting setting = getOrDefault(userId);
        return new UserPrivacySettingsResponse(
                setting.isRecordLoginActivity(),
                setting.isRecordPlayActivity(),
                setting.isPublicBeanLevel(),
                setting.isPublicLastOnline(),
                setting.isAllowPlaylistInvite()
        );
    }

    @Transactional
    public UserPrivacySettingsResponse updateSettings(long userId, UpdateUserPrivacySettingsRequest request) {
        UserPrivacySetting setting = getOrCreateWritable(userId);
        if (request.recordLoginActivity() != null) {
            setting.setRecordLoginActivity(request.recordLoginActivity());
        }
        if (request.recordPlayActivity() != null) {
            setting.setRecordPlayActivity(request.recordPlayActivity());
        }
        if (request.publicBeanLevel() != null) {
            setting.setPublicBeanLevel(request.publicBeanLevel());
        }
        if (request.publicLastOnline() != null) {
            setting.setPublicLastOnline(request.publicLastOnline());
        }
        if (request.allowPlaylistInvite() != null) {
            setting.setAllowPlaylistInvite(request.allowPlaylistInvite());
        }
        setting.setUpdatedAt(Instant.now());
        userPrivacySettingRepository.save(setting);
        return new UserPrivacySettingsResponse(
                setting.isRecordLoginActivity(),
                setting.isRecordPlayActivity(),
                setting.isPublicBeanLevel(),
                setting.isPublicLastOnline(),
                setting.isAllowPlaylistInvite()
        );
    }

    @Transactional(readOnly = true)
    public boolean shouldRecordLogin(long userId) {
        return getOrDefault(userId).isRecordLoginActivity();
    }

    @Transactional(readOnly = true)
    public boolean shouldRecordPlay(long userId) {
        return getOrDefault(userId).isRecordPlayActivity();
    }

    @Transactional(readOnly = true)
    public boolean canExposeBeanLevel(long userId) {
        return getOrDefault(userId).isPublicBeanLevel();
    }

    @Transactional(readOnly = true)
    public boolean canExposeLastOnline(long userId) {
        return getOrDefault(userId).isPublicLastOnline();
    }

    @Transactional(readOnly = true)
    public boolean canReceivePlaylistInvite(long userId) {
        return getOrDefault(userId).isAllowPlaylistInvite();
    }

    @Transactional
    public void recordLogin(long userId, String clientIp) {
        if (!shouldRecordLogin(userId)) {
            return;
        }
        UserLoginRecord row = new UserLoginRecord();
        row.setUserId(userId);
        row.setClientIp(clientIp);
        row.setLoginAt(Instant.now());
        userLoginRecordRepository.save(row);
    }

    private UserPrivacySetting getOrCreateWritable(long userId) {
        return userPrivacySettingRepository.findByUserId(userId).orElseGet(() -> {
            UserPrivacySetting row = new UserPrivacySetting();
            row.setUserId(userId);
            return userPrivacySettingRepository.save(row);
        });
    }

    private UserPrivacySetting getOrDefault(long userId) {
        return userPrivacySettingRepository.findByUserId(userId).orElseGet(() -> {
            UserPrivacySetting row = new UserPrivacySetting();
            row.setUserId(userId);
            return row;
        });
    }
}
