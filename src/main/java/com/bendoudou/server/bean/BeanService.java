package com.bendoudou.server.bean;

import com.bendoudou.server.bean.dto.BeanBalanceResponse;
import com.bendoudou.server.bean.dto.BeanLevelDto;
import com.bendoudou.server.bean.dto.BeanRuleDto;
import com.bendoudou.server.bean.dto.BeanTransactionDto;
import com.bendoudou.server.bean.dto.UpdateBeanLevelRequest;
import com.bendoudou.server.bean.dto.UpdateBeanRuleRequest;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class BeanService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");

    private final UserBeanAccountRepository accountRepository;
    private final UserBeanTransactionRepository transactionRepository;
    private final BeanRuleRepository beanRuleRepository;
    private final BeanLevelRepository beanLevelRepository;
    private final UserRepository userRepository;

    public BeanService(
            UserBeanAccountRepository accountRepository,
            UserBeanTransactionRepository transactionRepository,
            BeanRuleRepository beanRuleRepository,
            BeanLevelRepository beanLevelRepository,
            UserRepository userRepository
    ) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.beanRuleRepository = beanRuleRepository;
        this.beanLevelRepository = beanLevelRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void awardDailyUsage(long userId) {
        LocalDate today = LocalDate.now(APP_ZONE);
        UserBeanAccount account = getOrCreateAccount(userId);
        if (today.equals(account.getLastDailyAwardDate())) return;
        account.setLastDailyAwardDate(today);
        awardByRule(account, BeanActionType.DAILY_USAGE, BeanTransactionReason.DAILY_USAGE, null);
    }

    @Transactional
    public void awardByRule(long userId, BeanActionType actionType, BeanTransactionReason reason, Long relatedId) {
        UserBeanAccount account = getOrCreateAccount(userId);
        awardByRule(account, actionType, reason, relatedId);
    }

    @Transactional(readOnly = true)
    public BeanBalanceResponse getBalance(long userId) {
        long balance = queryBalance(userId);
        BeanLevel level = resolveLevel(balance);
        Long nextLevelMin = resolveNextLevelMin(balance);
        return new BeanBalanceResponse(
                balance,
                level == null ? "L1" : level.getCode(),
                level == null ? "Lv.1 新芽豆友" : level.getName(),
                nextLevelMin
        );
    }

    @Transactional(readOnly = true)
    public Page<BeanTransactionDto> listTransactions(long userId, Pageable pageable) {
        return transactionRepository
                .findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(tx -> new BeanTransactionDto(
                        tx.getId(),
                        tx.getUserId(),
                        resolveUserLabel(tx.getUserId()),
                        tx.getDelta(),
                        tx.getReason().name(),
                        tx.getActionType() == null ? null : tx.getActionType().name(),
                        tx.getRelatedId(),
                        tx.getCreatedAt().toEpochMilli()
                ));
    }

    @Transactional(readOnly = true)
    public Page<BeanTransactionDto> listTransactionsForAdmin(Pageable pageable) {
        return transactionRepository.findAllByOrderByCreatedAtDesc(pageable).map(tx -> new BeanTransactionDto(
                tx.getId(),
                tx.getUserId(),
                resolveUserLabel(tx.getUserId()),
                tx.getDelta(),
                tx.getReason().name(),
                tx.getActionType() == null ? null : tx.getActionType().name(),
                tx.getRelatedId(),
                tx.getCreatedAt().toEpochMilli()
        ));
    }

    @Transactional(readOnly = true)
    public List<BeanRuleDto> listRules() {
        List<BeanRule> rows = beanRuleRepository.findAll();
        if (rows.isEmpty()) {
            return defaultRuleDtos();
        }
        List<BeanRuleDto> out = new ArrayList<>();
        for (BeanRule row : rows) {
            out.add(new BeanRuleDto(row.getActionType().name(), row.getBeanDelta(), row.isEnabled()));
        }
        out.sort(Comparator.comparing(BeanRuleDto::actionType));
        return out;
    }

    @Transactional
    public List<BeanRuleDto> updateRules(List<UpdateBeanRuleRequest> requests) {
        initDefaultsIfNeeded();
        for (UpdateBeanRuleRequest req : requests) {
            BeanActionType action = BeanActionType.valueOf(req.actionType().trim().toUpperCase(Locale.ROOT));
            BeanRule row = beanRuleRepository.findByActionType(action).orElseGet(() -> {
                BeanRule created = new BeanRule();
                created.setActionType(action);
                return created;
            });
            row.setBeanDelta(req.beanDelta());
            row.setEnabled(req.enabled());
            row.setUpdatedAt(Instant.now());
            beanRuleRepository.save(row);
        }
        return listRules();
    }

    @Transactional(readOnly = true)
    public List<BeanLevelDto> listLevels() {
        List<BeanLevel> rows = beanLevelRepository.findAllByOrderByMinBeansAsc();
        if (rows.isEmpty()) {
            return defaultLevelDtos();
        }
        return rows.stream()
                .map(it -> new BeanLevelDto(it.getId(), it.getCode(), it.getName(), it.getMinBeans(), it.getSortOrder()))
                .toList();
    }

    @Transactional
    public List<BeanLevelDto> replaceLevels(List<UpdateBeanLevelRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("等级配置不能为空");
        }
        List<BeanLevel> next = new ArrayList<>();
        for (UpdateBeanLevelRequest req : requests) {
            BeanLevel level = new BeanLevel();
            level.setId(req.id());
            level.setCode(req.code().trim());
            level.setName(req.name().trim());
            level.setMinBeans(Math.max(0, req.minBeans()));
            level.setSortOrder(req.sortOrder());
            next.add(level);
        }
        next.sort(Comparator.comparingLong(BeanLevel::getMinBeans).thenComparingInt(BeanLevel::getSortOrder));
        beanLevelRepository.deleteAll();
        beanLevelRepository.saveAll(next);
        return listLevels();
    }

    @Transactional(readOnly = true)
    public String resolveLevelCode(long beanBalance) {
        BeanLevel level = resolveLevel(beanBalance);
        return level == null ? "L1" : level.getCode();
    }

    @Transactional(readOnly = true)
    public String resolveLevelName(long beanBalance) {
        BeanLevel level = resolveLevel(beanBalance);
        return level == null ? "Lv.1 新芽豆友" : level.getName();
    }

    @Transactional(readOnly = true)
    public long queryBalance(long userId) {
        return accountRepository.findByUserId(userId).map(UserBeanAccount::getBalance).orElse(0L);
    }

    private void awardByRule(UserBeanAccount account, BeanActionType actionType, BeanTransactionReason reason, Long relatedId) {
        initDefaultsIfNeeded();
        Optional<BeanRule> ruleOpt = beanRuleRepository.findByActionType(actionType);
        if (ruleOpt.isEmpty()) {
            return;
        }
        BeanRule rule = ruleOpt.get();
        if (!rule.isEnabled() || rule.getBeanDelta() == 0) {
            return;
        }
        applyDelta(account, rule.getBeanDelta(), reason, actionType, relatedId);
    }

    private void applyDelta(UserBeanAccount account, int delta,
                            BeanTransactionReason reason,
                            BeanActionType actionType,
                            Long relatedId) {
        account.setBalance(account.getBalance() + delta);
        account.setUpdatedAt(Instant.now());
        accountRepository.save(account);

        UserBeanTransaction tx = new UserBeanTransaction();
        tx.setUserId(account.getUserId());
        tx.setDelta(delta);
        tx.setReason(reason);
        tx.setActionType(actionType);
        tx.setRelatedId(relatedId);
        transactionRepository.save(tx);
    }

    private UserBeanAccount getOrCreateAccount(long userId) {
        return accountRepository.findByUserId(userId).orElseGet(() -> {
            UserBeanAccount a = new UserBeanAccount();
            a.setUserId(userId);
            return accountRepository.save(a);
        });
    }

    private BeanLevel resolveLevel(long beanBalance) {
        List<BeanLevel> levels = currentLevelsOrDefaults();
        BeanLevel out = null;
        for (BeanLevel lv : levels) {
            if (beanBalance >= lv.getMinBeans()) {
                out = lv;
            } else {
                break;
            }
        }
        return out;
    }

    private Long resolveNextLevelMin(long beanBalance) {
        for (BeanLevel lv : currentLevelsOrDefaults()) {
            if (lv.getMinBeans() > beanBalance) {
                return lv.getMinBeans();
            }
        }
        return null;
    }

    private void initDefaultsIfNeeded() {
        if (beanRuleRepository.count() == 0) {
            saveDefaultRule(BeanActionType.DAILY_USAGE, 1);
            saveDefaultRule(BeanActionType.TRACK_PLAY, 1);
            saveDefaultRule(BeanActionType.TRACK_HEART, 1);
            saveDefaultRule(BeanActionType.TRACK_COMMENT, 2);
            saveDefaultRule(BeanActionType.GUESTBOOK_POST, 5);
            saveDefaultRule(BeanActionType.PLAYLIST_CREATE, 1);
        }
        if (beanLevelRepository.count() == 0) {
            createDefaultLevel("L1", "Lv.1 新芽豆友", 0, 1);
            createDefaultLevel("L2", "Lv.2 活跃豆友", 20, 2);
            createDefaultLevel("L3", "Lv.3 热爱豆友", 60, 3);
            createDefaultLevel("L4", "Lv.4 热门豆友", 120, 4);
            createDefaultLevel("L5", "Lv.5 进阶豆友", 200, 5);
            createDefaultLevel("L6", "Lv.6 资深豆友", 320, 6);
            createDefaultLevel("L7", "Lv.7 核心豆友", 480, 7);
            createDefaultLevel("L8", "Lv.8 大神豆友", 700, 8);
            createDefaultLevel("L9", "Lv.9 传说豆友", 1000, 9);
            createDefaultLevel("L10", "Lv.10 满级豆友", 1400, 10);
            return;
        }
        // 兼容已上线老数据（可能只有 4 级）：自动补齐到 10 级
        List<BeanLevel> existing = beanLevelRepository.findAllByOrderByMinBeansAsc();
        if (existing.size() >= 10) {
            return;
        }
        Set<String> existingCodes = new HashSet<>();
        for (BeanLevel lv : existing) {
            if (lv.getCode() != null) {
                existingCodes.add(lv.getCode().trim().toUpperCase(Locale.ROOT));
            }
        }
        String[] codes = {"L1","L2","L3","L4","L5","L6","L7","L8","L9","L10"};
        String[] names = {
                "Lv.1 新芽豆友",
                "Lv.2 活跃豆友",
                "Lv.3 热爱豆友",
                "Lv.4 热门豆友",
                "Lv.5 进阶豆友",
                "Lv.6 资深豆友",
                "Lv.7 核心豆友",
                "Lv.8 大神豆友",
                "Lv.9 传说豆友",
                "Lv.10 满级豆友"
        };
        long[] mins = {0, 20, 60, 120, 200, 320, 480, 700, 1000, 1400};
        for (int i = 0; i < codes.length; i++) {
            if (!existingCodes.contains(codes[i])) {
                createDefaultLevel(codes[i], names[i], mins[i], i + 1);
            }
        }
    }

    private List<BeanLevel> currentLevelsOrDefaults() {
        List<BeanLevel> rows = beanLevelRepository.findAllByOrderByMinBeansAsc();
        if (!rows.isEmpty()) {
            return rows;
        }
        return defaultLevelEntities();
    }

    private List<BeanRuleDto> defaultRuleDtos() {
        List<BeanRuleDto> out = new ArrayList<>();
        out.add(new BeanRuleDto(BeanActionType.DAILY_USAGE.name(), 1, true));
        out.add(new BeanRuleDto(BeanActionType.TRACK_PLAY.name(), 1, true));
        out.add(new BeanRuleDto(BeanActionType.TRACK_HEART.name(), 1, true));
        out.add(new BeanRuleDto(BeanActionType.TRACK_COMMENT.name(), 2, true));
        out.add(new BeanRuleDto(BeanActionType.GUESTBOOK_POST.name(), 5, true));
        out.add(new BeanRuleDto(BeanActionType.PLAYLIST_CREATE.name(), 1, true));
        out.sort(Comparator.comparing(BeanRuleDto::actionType));
        return out;
    }

    private List<BeanLevelDto> defaultLevelDtos() {
        List<BeanLevelDto> out = new ArrayList<>();
        int idx = 1;
        for (BeanLevel e : defaultLevelEntities()) {
            out.add(new BeanLevelDto(0L, e.getCode(), e.getName(), e.getMinBeans(), idx++));
        }
        return out;
    }

    private List<BeanLevel> defaultLevelEntities() {
        String[] codes = {"L1","L2","L3","L4","L5","L6","L7","L8","L9","L10"};
        String[] names = {
                "Lv.1 新芽豆友","Lv.2 活跃豆友","Lv.3 热爱豆友","Lv.4 热门豆友","Lv.5 进阶豆友",
                "Lv.6 资深豆友","Lv.7 核心豆友","Lv.8 大神豆友","Lv.9 传说豆友","Lv.10 满级豆友"
        };
        long[] mins = {0, 20, 60, 120, 200, 320, 480, 700, 1000, 1400};
        List<BeanLevel> out = new ArrayList<>();
        for (int i = 0; i < codes.length; i++) {
            BeanLevel lv = new BeanLevel();
            lv.setCode(codes[i]);
            lv.setName(names[i]);
            lv.setMinBeans(mins[i]);
            lv.setSortOrder(i + 1);
            out.add(lv);
        }
        return out;
    }

    private void saveDefaultRule(BeanActionType actionType, int delta) {
        BeanRule row = new BeanRule();
        row.setActionType(actionType);
        row.setBeanDelta(delta);
        row.setEnabled(true);
        row.setUpdatedAt(Instant.now());
        beanRuleRepository.save(row);
    }

    private void createDefaultLevel(String code, String name, long minBeans, int sortOrder) {
        BeanLevel lv = new BeanLevel();
        lv.setCode(code);
        lv.setName(name);
        lv.setMinBeans(minBeans);
        lv.setSortOrder(sortOrder);
        beanLevelRepository.save(lv);
    }

    private String resolveUserLabel(Long userId) {
        if (userId == null) return "-";
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) return "#" + userId;
        if (u.getDisplayName() != null && !u.getDisplayName().isBlank()) {
            return u.getDisplayName().trim();
        }
        return u.getEmail();
    }
}
