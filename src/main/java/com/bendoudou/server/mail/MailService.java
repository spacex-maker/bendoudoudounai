package com.bendoudou.server.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * 注册验证码邮件。SMTP 与 productx-backend/core 的 QQ 通道（spring.mail.user）同一套账号。
 */
@Service
public class MailService {

    private final JavaMailSender mailSender;
    private final String personal;

    public MailService(
            JavaMailSender mailSender,
            @Value("${bendoudou.mail.personal:AIMATEX-MUSIC}") String personal
    ) {
        this.mailSender = mailSender;
        this.personal = personal;
    }

    private String fromAddress() {
        if (mailSender instanceof JavaMailSenderImpl impl && StringUtils.hasText(impl.getUsername())) {
            return impl.getUsername();
        }
        return null;
    }

    public void sendPlain(String to, String subject, String text) {
        String from = fromAddress();
        if (!StringUtils.hasText(from)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "邮件服务未配置");
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(text);
            mailSender.send(msg);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "验证码邮件发送失败：" + e.getMessage());
        }
    }

    public void sendRegisterCode(String to, String code, String locale) {
        boolean ja = locale != null && locale.toLowerCase().startsWith("ja");
        String subject = ja
                ? "【" + personal + "】登録確認コード"
                : "【" + personal + "】邮箱注册验证码";
        String body = ja
                ? """
                  こんにちは。

                  あなたの登録確認コードは：%s

                  有効期限は 5 分です。本人でない場合はこのメールを無視してください。

                  — %s
                  """.formatted(code, personal)
                : """
                  你好，

                  你的注册验证码是：%s

                  5 分钟内有效。如非本人操作请忽略本邮件。

                  — %s
                  """.formatted(code, personal);
        sendPlain(to, subject, body);
    }

    public void sendResetPasswordCode(String to, String code, String locale) {
        boolean ja = locale != null && locale.toLowerCase().startsWith("ja");
        String subject = ja
                ? "【" + personal + "】パスワード再設定"
                : "【" + personal + "】重置密码";
        String body = ja
                ? """
                  こんにちは。

                  パスワード再設定用の確認コードは：%s

                  有効期限は 5 分です。本人でない場合はこのメールを無視してください。

                  — %s
                  """.formatted(code, personal)
                : """
                  尊敬的用户：

                  您的验证码为：%s

                  验证码有效期为 5 分钟，请尽快验证。

                  如非本人操作，请忽略此邮件。

                  — %s
                  """.formatted(code, personal);
        sendPlain(to, subject, body);
    }

    public void sendRegistrationRejected(String to, String reason, String locale) {
        boolean ja = locale != null && locale.toLowerCase().startsWith("ja");
        String subject = ja
                ? "【" + personal + "】登録申請が却下されました"
                : "【" + personal + "】注册申请未通过";
        String safeReason = reason == null || reason.isBlank() ? (ja ? "（理由なし）" : "（未填写）") : reason;
        String body = ja
                ? """
                  こんにちは。

                  残念ながら、あなたの登録申請は承認されませんでした。

                  却下理由：
                  %s

                  内容を修正のうえ、再度お申し込みいただけます。

                  — %s
                  """.formatted(safeReason, personal)
                : """
                  你好，

                  很抱歉，你的注册申请未通过审核。

                  拒绝原因：
                  %s

                  你可以根据原因修改资料后重新提交申请。

                  — %s
                  """.formatted(safeReason, personal);
        sendPlain(to, subject, body);
    }

    public void sendRegistrationApproved(String to, String locale) {
        boolean ja = locale != null && locale.toLowerCase().startsWith("ja");
        String subject = ja
                ? "【" + personal + "】登録申請が承認されました"
                : "【" + personal + "】注册申请已通过";
        String body = ja
                ? """
                  こんにちは。

                  登録申請が承認されました。申請時のメールとパスワードでログインしてください。

                  — %s
                  """.formatted(personal)
                : """
                  你好，

                  你的注册申请已通过审核。请使用申请时填写的邮箱和密码登录。

                  — %s
                  """.formatted(personal);
        sendPlain(to, subject, body);
    }
}
